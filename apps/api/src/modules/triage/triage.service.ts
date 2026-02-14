import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NvidiaService } from '../nvidia/nvidia.service';
import { ManageAPI } from 'connectwise-rest';
import { TRIAGE_CW_API } from './triage.constants';

interface BoardType {
  id: number;
  name: string;
  subtypes: { name: string; items: string[] }[];
}

interface BoardCache {
  boardId: number;
  boardName: string;
  types: BoardType[];
}

interface ClassificationResult {
  board?: string;
  type?: string;
  subtype?: string;
  item?: string;
  priority?: string;
  reasoning?: string;
  troubleshooting?: string;
  rawResponse: string;
}

interface TicketData {
  id: number;
  summary: string;
  description: string;
  company: string;
  contact: string;
  source: string;
}

const BOARDS = [
  { id: 51, name: 'Tier 1 Incident' },
  { id: 54, name: 'Tier 2 Incident' },
  { id: 56, name: 'Tier 3 Incident' },
  { id: 53, name: 'Tier 1 RFC' },
  { id: 57, name: 'Tier 2 RFC' },
  { id: 58, name: 'Tier 3 RFC' },
];

@Injectable()
export class TriageService implements OnModuleInit {
  private readonly logger = new Logger(TriageService.name);
  private boardCaches: Map<number, BoardCache> = new Map();
  private itilPrompt: string | null = null;
  private readonly dispatchBoardId: number;
  private recentlyProcessed: Set<number> = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly nvidia: NvidiaService,
    private readonly config: ConfigService,
    private readonly cw: ManageAPI,
    @Inject(TRIAGE_CW_API) private readonly triageCw: ManageAPI,
  ) {
    this.dispatchBoardId = parseInt(
      this.config.get<string>('TRIAGE_DISPATCH_BOARD_ID', '35'),
      10,
    );
  }

  async onModuleInit() {
    // Load caches from DB on startup
    await this.loadCachesFromDb();

    // Load ITIL prompt from DB (prompt_templates with useCase = 'TRIAGE')
    await this.loadItilPrompt();

    // If no cache exists, trigger initial refresh
    if (this.boardCaches.size === 0) {
      this.logger.log('No triage cache found, triggering initial refresh...');
      await this.refreshAllBoardCaches();
    }

    // Register CW callback if enabled
    const callbackEnabled = this.config.get<string>('TRIAGE_CALLBACK_ENABLED', 'false');
    if (callbackEnabled === 'true') {
      this.ensureCallback().catch((err) => {
        this.logger.error(`Failed to register CW callback: ${err.message}`);
      });
    }

    // Clear recently-processed set every 10 minutes (prevent unbounded growth)
    setInterval(() => this.recentlyProcessed.clear(), 10 * 60_000);
  }

  // ─── CW Callback (Webhook) ────────────────────────────────────────

  /**
   * Handle incoming CW callback payload.
   * Called from the controller's unauthenticated webhook endpoint.
   */
  async handleCallback(payload: {
    ID?: number;
    Type?: string;
    Action?: string;
    Entity?: any;
  }): Promise<{ processed: boolean; ticketId?: number; reason?: string }> {
    const ticketId = payload.ID;
    const action = payload.Action;

    if (!ticketId || payload.Type !== 'ticket') {
      return { processed: false, reason: 'Not a ticket callback' };
    }

    // Only process 'added' actions (new tickets hitting the board)
    // Also handle 'updated' in case ticket is moved TO dispatch board
    if (action !== 'added' && action !== 'updated') {
      return { processed: false, reason: `Ignoring action: ${action}`, ticketId };
    }

    // Dedup: immediately mark as processed BEFORE any async work.
    // CW fires added + updated simultaneously; this prevents both getting through.
    if (this.recentlyProcessed.has(ticketId)) {
      return { processed: false, reason: 'Recently processed', ticketId };
    }
    this.recentlyProcessed.add(ticketId);

    // Also check DB — if we already classified this ticket, skip
    const existingLog = await this.prisma.triageLog.findFirst({
      where: { ticketId, notePosted: true },
      select: { id: true },
    });
    if (existingLog) {
      return { processed: false, reason: 'Already classified and note posted', ticketId };
    }

    // Check if ticket is actually on the dispatch board
    try {
      const ticket = await this.cw.request({
        path: `/service/tickets/${ticketId}`,
        method: 'get',
        params: { fields: 'id,board/id,board/name' },
      });

      if (ticket?.board?.id !== this.dispatchBoardId) {
        return { processed: false, reason: `Ticket on board ${ticket?.board?.id}, not dispatch (${this.dispatchBoardId})`, ticketId };
      }
    } catch (err) {
      this.logger.error(`Failed to verify ticket #${ticketId} board: ${err.message}`);
      return { processed: false, reason: `Failed to verify board: ${err.message}`, ticketId };
    }

    this.logger.log(`CW callback: classifying ticket #${ticketId} (action: ${action})`);

    try {
      const result = await this.classifyTicket(ticketId);
      return { processed: true, ticketId };
    } catch (err) {
      this.logger.error(`Callback classification failed for ticket #${ticketId}: ${err.message}`);
      return { processed: false, reason: err.message, ticketId };
    }
  }

  /**
   * Register (or verify) the CW callback for ticket events.
   * Uses the triage CW API (The_Oracle member) to register.
   */
  async ensureCallback(): Promise<{ id: number; status: string }> {
    const baseUrl = this.config.get<string>(
      'TRIAGE_CALLBACK_URL',
      'https://theoracle.ingeniotech.co.uk',
    );
    const callbackUrl = `${baseUrl}/api/v1/triage/webhook`;

    // Check for existing callback
    try {
      const existing = await this.triageCw.request({
        path: '/system/callbacks',
        method: 'get',
        params: {
          conditions: `url='${callbackUrl}'`,
          pageSize: 5,
        },
      });

      if (existing?.length > 0) {
        const cb = existing[0];
        if (cb.inactiveFlag) {
          // Re-activate
          await this.triageCw.request({
            path: `/system/callbacks/${cb.id}`,
            method: 'patch',
            data: [{ op: 'replace', path: 'inactiveFlag', value: false }],
          });
          this.logger.log(`Re-activated CW callback #${cb.id}`);
          return { id: cb.id, status: 'reactivated' };
        }
        this.logger.log(`CW callback already registered: #${cb.id}`);
        return { id: cb.id, status: 'existing' };
      }
    } catch (err) {
      this.logger.warn(`Could not check existing callbacks: ${err.message}`);
    }

    // Register new callback
    const callback = await this.triageCw.request({
      path: '/system/callbacks',
      method: 'post',
      data: {
        url: callbackUrl,
        // For ticket callbacks, CW requires objectId + level=owner.
        // objectId=1 is the standard ticket callback object.
        objectId: 1,
        type: 'ticket',
        level: 'owner',
        description: 'Oracle Auto-Triage: classify new tickets on Tier-Dispatch board',
        inactiveFlag: false,
      },
    });

    this.logger.log(`Registered CW callback #${callback.id} → ${callbackUrl}`);
    return { id: callback.id, status: 'created' };
  }

  /**
   * List all registered CW callbacks (admin visibility)
   */
  async listCallbacks(): Promise<any[]> {
    return this.triageCw.request({
      path: '/system/callbacks',
      method: 'get',
      params: { pageSize: 100 },
    });
  }

  // ─── Cache Management ─────────────────────────────────────────────

  /**
   * Refresh all board caches from CW ServiceItem report
   */
  async refreshAllBoardCaches(): Promise<{ boardId: number; comboCount: number }[]> {
    const results: { boardId: number; comboCount: number }[] = [];

    for (const board of BOARDS) {
      try {
        const cache = await this.refreshBoardCache(board.id, board.name);
        results.push({ boardId: board.id, comboCount: cache.types.reduce((sum, t) => sum + t.subtypes.reduce((s2, st) => s2 + st.items.length, 0), 0) });
      } catch (error) {
        this.logger.error(`Failed to refresh cache for board ${board.id} (${board.name}): ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Refresh cache for a single board using CW ServiceItem report
   */
  private async refreshBoardCache(boardId: number, boardName: string): Promise<BoardCache> {
    this.logger.log(`Refreshing cache for board ${boardId} (${boardName})...`);

    // Use CW reporting API - the key discovery from prototype testing
    const conditions = `Board_Name='${boardName}' AND Inactive_Flag=false`;
    let allRows: any[][] = [];
    let page = 1;

    while (true) {
      const data = await this.cw.request({
        path: '/system/reports/ServiceItem',
        method: 'get',
        params: {
          conditions,
          pageSize: 1000,
          page,
        },
      });

      const rows = data?.row_values || [];
      if (rows.length === 0) break;
      allRows = allRows.concat(rows);
      if (rows.length < 1000) break;
      page++;
    }

    // Parse rows: [itemRecId, itemDesc, boardRecId, boardName, inactive, subtypeRecId, subtypeDesc, typeRecId, typeDesc, ...]
    const typeMap: Record<string, { id: number; name: string; subtypes: Record<string, { name: string; items: string[] }> }> = {};

    for (const row of allRows) {
      const itemName = row[1] as string;
      const subtypeName = row[6] as string;
      const typeRecId = row[7] as number;
      const typeName = row[8] as string;

      if (!typeName || !subtypeName || !itemName) continue;

      if (!typeMap[typeName]) {
        typeMap[typeName] = { id: typeRecId, name: typeName, subtypes: {} };
      }
      if (!typeMap[typeName].subtypes[subtypeName]) {
        typeMap[typeName].subtypes[subtypeName] = { name: subtypeName, items: [] };
      }
      if (!typeMap[typeName].subtypes[subtypeName].items.includes(itemName)) {
        typeMap[typeName].subtypes[subtypeName].items.push(itemName);
      }
    }

    // Convert to array structure
    const types: BoardType[] = Object.values(typeMap)
      .map((t) => ({
        id: t.id,
        name: t.name,
        subtypes: Object.values(t.subtypes)
          .map((s) => ({ name: s.name, items: s.items.sort() }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const comboCount = allRows.length;
    const cache: BoardCache = { boardId, boardName, types };

    // Save to DB
    await this.prisma.triageCache.upsert({
      where: { boardId },
      create: { boardId, boardName, hierarchy: cache.types as any, comboCount },
      update: { boardName, hierarchy: cache.types as any, comboCount, lastRefreshed: new Date() },
    });

    // Update in-memory cache
    this.boardCaches.set(boardId, cache);

    this.logger.log(`Board ${boardId} (${boardName}): ${types.length} types, ${comboCount} valid combinations`);
    return cache;
  }

  /**
   * Load caches from DB into memory
   */
  private async loadCachesFromDb() {
    const caches = await this.prisma.triageCache.findMany();
    for (const cache of caches) {
      this.boardCaches.set(cache.boardId, {
        boardId: cache.boardId,
        boardName: cache.boardName,
        types: cache.hierarchy as unknown as BoardType[],
      });
    }
    this.logger.log(`Loaded ${caches.length} board caches from database`);
  }

  /**
   * Load ITIL prompt from prompt_templates
   */
  private async loadItilPrompt() {
    const prompt = await this.prisma.promptTemplate.findFirst({
      where: { useCase: 'TRIAGE', isActive: true },
      orderBy: { version: 'desc' },
    });

    if (prompt) {
      this.itilPrompt = prompt.content;
      this.logger.log('Loaded ITIL triage prompt from database');
    } else {
      this.logger.warn('No active TRIAGE prompt found in prompt_templates. Triage will not function until one is created.');
    }
  }

  // ─── Product Matching ─────────────────────────────────────────────

  /**
   * Match ticket text against product aliases
   */
  async matchProducts(text: string): Promise<string[]> {
    const aliases = await this.prisma.productAlias.findMany({
      where: { isActive: true },
    });

    const matched: string[] = [];

    for (const alias of aliases) {
      const keywords = alias.keywords as string[];
      const hit = keywords.some((kw: string) => {
        if (kw.startsWith('^')) {
          const word = kw.slice(1);
          const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          return regex.test(text);
        }
        return text.toLowerCase().includes(kw.toLowerCase());
      });

      if (hit) {
        matched.push(alias.product);
      }
    }

    return matched;
  }

  // ─── Classification ───────────────────────────────────────────────

  /**
   * Build the LLM prompt with board hierarchy + product context
   */
  private buildPrompt(ticketData: TicketData, matchedProducts: string[]): { systemPrompt: string; userPrompt: string } {
    if (!this.itilPrompt) {
      throw new Error('No active TRIAGE prompt configured. Please create one in Prompt Management.');
    }

    // Build hierarchical board category listing
    let boardSection = '';
    for (const board of BOARDS) {
      const cache = this.boardCaches.get(board.id);
      if (!cache) continue;

      boardSection += `\n### Board: ${cache.boardName} (ID: ${cache.boardId})\n`;
      boardSection += `Valid Type > Subtype > Item combinations:\n`;

      for (const type of cache.types) {
        boardSection += `\n**${type.name}:**\n`;
        for (const subtype of type.subtypes) {
          boardSection += `  ${subtype.name} → [${subtype.items.join(', ')}]\n`;
        }
      }
    }

    // Product context
    let productSection = '';
    if (matchedProducts.length > 0) {
      productSection = `\n[Product Context:]\nMatched product(s) for this ticket: ${matchedProducts.join(', ')}\n`;
    }

    const systemPrompt = `${this.itilPrompt}

---

### Available Boards and Categories (LIVE from ConnectWise):
${boardSection}
${productSection}`;

    const userPrompt = `Classify this ticket:

Company: ${ticketData.company || 'Unknown'}
Contact: ${ticketData.contact || 'Unknown'}
Source: ${ticketData.source || 'Unknown'}
Summary: ${ticketData.summary}
Description: ${ticketData.description || 'No description provided'}`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse the LLM response into structured fields
   */
  private parseClassification(response: string): ClassificationResult {
    const result: ClassificationResult = { rawResponse: response };

    const boardMatch = response.match(/Board:\s*(.+)/i);
    const typeMatch = response.match(/Type:\s*(.+)/i);
    const subtypeMatch = response.match(/Subtype:\s*(.+)/i);
    const itemMatch = response.match(/Item:\s*(.+)/i);
    const priorityMatch = response.match(/Priority:\s*(.+)/i);
    // Flexible matching for reasoning and troubleshooting — LLM output varies
    const reasoningMatch = response.match(/Reasoning:\s*([\s\S]*?)(?=\n\s*(?:\d+[\.\)]\s|troubleshoot|5 troubleshoot|$))/i);
    const troubleshootingMatch = response.match(/(?:5 troubleshooting items?|troubleshooting(?: steps)?|troubleshoot):\s*([\s\S]*?)$/i);

    if (boardMatch) result.board = boardMatch[1].trim();
    if (typeMatch) result.type = typeMatch[1].trim();
    if (subtypeMatch) result.subtype = subtypeMatch[1].trim();
    if (itemMatch) result.item = itemMatch[1].trim();
    if (priorityMatch) result.priority = priorityMatch[1].trim();
    if (reasoningMatch) result.reasoning = reasoningMatch[1].trim();
    if (troubleshootingMatch) result.troubleshooting = troubleshootingMatch[1].trim();

    return result;
  }

  /**
   * Validate classification against board cache
   */
  private validateClassification(result: ClassificationResult): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!result.board || !result.type || !result.subtype || !result.item) {
      warnings.push('Missing required classification fields');
      return { isValid: false, warnings };
    }

    const board = BOARDS.find((b) => result.board!.includes(b.name));
    if (!board) {
      warnings.push(`Board "${result.board}" not recognised`);
      return { isValid: false, warnings };
    }

    const cache = this.boardCaches.get(board.id);
    if (!cache) {
      warnings.push(`No cache for board ${board.id}`);
      return { isValid: false, warnings };
    }

    const typeObj = cache.types.find((t) => t.name === result.type);
    if (!typeObj) {
      warnings.push(`Type "${result.type}" NOT FOUND in ${board.name}`);
      return { isValid: false, warnings };
    }

    const subtypeObj = typeObj.subtypes.find((s) => s.name === result.subtype);
    if (!subtypeObj) {
      warnings.push(`Subtype "${result.subtype}" NOT valid under Type "${result.type}"`);
      return { isValid: false, warnings };
    }

    if (!subtypeObj.items.includes(result.item!)) {
      warnings.push(`Item "${result.item}" NOT valid under ${result.type} > ${result.subtype}`);
      return { isValid: false, warnings };
    }

    return { isValid: true, warnings: [] };
  }

  /**
   * Classify a ticket by ID
   */
  async classifyTicket(ticketId: number): Promise<any> {
    const startTime = Date.now();

    // Fetch ticket from CW
    const ticket = await this.getTicketData(ticketId);

    // Match products
    const searchText = `${ticket.summary} ${ticket.description}`;
    const matchedProducts = await this.matchProducts(searchText);

    // Build prompt and classify
    const { systemPrompt, userPrompt } = this.buildPrompt(ticket, matchedProducts);

    const modelOverride = this.config.get<string>('TRIAGE_MODEL', 'moonshotai/kimi-k2-instruct');

    const completion = await this.nvidia.createChatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { temperature: 0.1, maxTokens: 1024 },
      modelOverride,
    );

    const responseTimeMs = Date.now() - startTime;
    const responseText = completion.choices[0]?.message?.content?.trim() || '';
    this.logger.debug(`LLM response for ticket #${ticketId}:\n${responseText}`);

    // Parse and validate
    const classification = this.parseClassification(responseText);
    const validation = this.validateClassification(classification);

    // Log to database
    const log = await this.prisma.triageLog.create({
      data: {
        ticketId,
        ticketSummary: ticket.summary,
        companyName: ticket.company,
        contactName: ticket.contact,
        source: ticket.source,
        board: classification.board,
        type: classification.type,
        subtype: classification.subtype,
        item: classification.item,
        priority: classification.priority,
        reasoning: classification.reasoning,
        troubleshooting: classification.troubleshooting,
        matchedProducts: matchedProducts as any,
        isValid: validation.isValid,
        warnings: validation.warnings.length > 0 ? (validation.warnings as any) : undefined,
        modelUsed: modelOverride,
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        responseTimeMs,
      },
    });

    this.logger.log(
      `Classified ticket #${ticketId}: ${classification.board} / ${classification.type} / ${classification.subtype} / ${classification.item} (valid: ${validation.isValid}, ${responseTimeMs}ms)`,
    );

    // Auto-post note to CW ticket if classification is valid
    if (validation.isValid) {
      try {
        await this.postTriageNote(ticketId, log.id);
      } catch (err) {
        this.logger.error(`Failed to auto-post note for ticket #${ticketId}: ${err.message}`);
      }
    }

    return {
      id: log.id,
      ticketId,
      ticketSummary: ticket.summary,
      company: ticket.company,
      classification: {
        board: classification.board,
        type: classification.type,
        subtype: classification.subtype,
        item: classification.item,
        priority: classification.priority,
      },
      reasoning: classification.reasoning,
      troubleshooting: classification.troubleshooting,
      matchedProducts,
      validation,
      responseTimeMs,
    };
  }

  /**
   * Get ticket data from CW
   */
  private async getTicketData(ticketId: number): Promise<TicketData> {
    const ticket = await this.cw.request({
      path: `/service/tickets/${ticketId}`,
      method: 'get',
    });

    // Try to get initial description from notes if not on ticket
    let description = ticket.initialDescription || '';
    if (!description) {
      try {
        const notes = await this.cw.request({
          path: `/service/tickets/${ticketId}/notes`,
          method: 'get',
          params: { pageSize: 1, orderBy: 'id' },
        });
        if (notes?.length > 0) description = notes[0].text || '';
      } catch {
        // Ignore - no notes
      }
    }

    return {
      id: ticket.id,
      summary: ticket.summary || '',
      description,
      company: ticket.company?.name || 'Unknown',
      contact: ticket.contact?.name || 'Unknown',
      source: ticket.source?.name || 'Unknown',
    };
  }

  // ─── Note Posting ──────────────────────────────────────────────────

  /**
   * Post triage classification as an internal note on the CW ticket
   */
  async postTriageNote(ticketId: number, triageLogId: string): Promise<void> {
    const log = await this.prisma.triageLog.findUniqueOrThrow({
      where: { id: triageLogId },
    });

    const matchedProducts = (log.matchedProducts as string[]) || [];

    const lines = [
      '🔮 Oracle Auto-Triage Classification',
      '═══════════════════════════════════════',
      '',
      `📋 Board: ${log.board || 'N/A'}`,
      `📁 Type: ${log.type || 'N/A'}`,
      `📂 Subtype: ${log.subtype || 'N/A'}`,
      `📄 Item: ${log.item || 'N/A'}`,
      `⚡ Priority: ${log.priority || 'N/A'}`,
      '',
      `✅ Valid: ${log.isValid ? 'Yes' : 'No'}`,
    ];

    if (log.reasoning) {
      lines.push('', `💡 Reasoning: ${log.reasoning}`);
    }

    if (log.troubleshooting) {
      lines.push('', '🔧 Troubleshooting:', log.troubleshooting);
    }

    if (matchedProducts.length > 0) {
      lines.push('', `🏷️ Matched Products: ${matchedProducts.join(', ')}`);
    }

    lines.push('', `⏱️ Response Time: ${log.responseTimeMs}ms | Model: ${log.modelUsed}`);

    const text = lines.join('\n');

    try {
      await this.triageCw.request({
        path: `/service/tickets/${ticketId}/notes`,
        method: 'post',
        data: {
          text,
          internalAnalysisFlag: true,
          detailDescriptionFlag: false,
        },
      });

      await this.prisma.triageLog.update({
        where: { id: triageLogId },
        data: { notePosted: true, notePostedAt: new Date() },
      });

      this.logger.log(`Posted triage note to ticket #${ticketId}`);
    } catch (err) {
      this.logger.error(`Failed to post triage note to ticket #${ticketId}: ${err.message}`);
    }
  }

  // ─── Admin / API ──────────────────────────────────────────────────

  /**
   * Get cache status for all boards
   */
  async getCacheStatus() {
    const caches = await this.prisma.triageCache.findMany({
      orderBy: { boardId: 'asc' },
    });
    return caches.map((c) => ({
      boardId: c.boardId,
      boardName: c.boardName,
      comboCount: c.comboCount,
      lastRefreshed: c.lastRefreshed,
    }));
  }

  /**
   * Get triage log with pagination
   */
  async getTriageLogs(page = 1, limit = 20) {
    const [logs, total] = await Promise.all([
      this.prisma.triageLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.triageLog.count(),
    ]);

    return { logs, total, page, limit, pages: Math.ceil(total / limit) };
  }

  /**
   * Reload the ITIL prompt from DB (after edits)
   */
  async reloadPrompt() {
    await this.loadItilPrompt();
    return { loaded: !!this.itilPrompt };
  }
}
