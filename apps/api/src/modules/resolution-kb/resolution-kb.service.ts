import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NvidiaService } from '../nvidia/nvidia.service';
import { ManageAPI } from 'connectwise-rest';
import { Inject } from '@nestjs/common';
import { TRIAGE_CW_API } from '../triage/triage.constants';
import {
  PII_PATTERNS,
  DEFAULT_EMBEDDING_MODEL,
} from './resolution-kb.constants';

interface ClosedTicket {
  id: number;
  summary: string;
  board?: { id: number; name: string };
  type?: { id: number; name: string };
  subType?: { id: number; name: string };
  item?: { id: number; name: string };
  company?: { id: number; name: string };
  contact?: { id: number; name: string };
  closedDate: string;
  actualHours?: number;
}

export interface SimilarResolution {
  ticketId: number;
  summary: string;
  resolution: string | null;
  board: string | null;
  type: string | null;
  subtype: string | null;
  item: string | null;
  minutesToResolve: number | null;
  closedAt: Date;
  similarity: number;
}

@Injectable()
export class ResolutionKbService implements OnModuleInit {
  private readonly logger = new Logger(ResolutionKbService.name);
  private companyNames: Set<string> = new Set();
  private contactNames: Set<string> = new Set();

  constructor(
    private readonly prisma: PrismaService,
    private readonly nvidia: NvidiaService,
    private readonly config: ConfigService,
    @Inject(TRIAGE_CW_API) private readonly cw: ManageAPI,
  ) {}

  async onModuleInit() {
    // Pre-load company and contact names for anonymisation
    await this.refreshNameCache();
  }

  // ─── Anonymisation ────────────────────────────────────────────────

  /**
   * Refresh the cache of company/contact names from CW for anonymisation
   */
  async refreshNameCache(): Promise<{ companies: number; contacts: number }> {
    try {
      // Get active companies
      const companies = await this.cw.request({
        path: '/company/companies',
        method: 'get',
        params: {
          conditions: "status/id=1", // Active
          fields: 'id,name',
          pageSize: 1000,
        },
      });
      this.companyNames = new Set(
        (companies || [])
          .map((c: any) => c.name?.trim())
          .filter((n: string) => n && n.length > 2),
      );

      // Get contacts (paginated — could be large)
      const contacts = await this.cw.request({
        path: '/company/contacts',
        method: 'get',
        params: {
          fields: 'id,firstName,lastName',
          pageSize: 1000,
        },
      });
      this.contactNames = new Set();
      for (const c of contacts || []) {
        if (c.firstName?.trim()) this.contactNames.add(c.firstName.trim());
        if (c.lastName?.trim()) this.contactNames.add(c.lastName.trim());
        if (c.firstName && c.lastName) {
          this.contactNames.add(`${c.firstName.trim()} ${c.lastName.trim()}`);
        }
      }

      this.logger.log(
        `Name cache refreshed: ${this.companyNames.size} companies, ${this.contactNames.size} contact names`,
      );
      return { companies: this.companyNames.size, contacts: this.contactNames.size };
    } catch (err) {
      this.logger.error(`Failed to refresh name cache: ${err.message}`);
      return { companies: this.companyNames.size, contacts: this.contactNames.size };
    }
  }

  /**
   * Anonymise text by removing PII
   */
  anonymise(text: string): string {
    if (!text) return text;

    let result = text;

    // Replace company names (longest first to avoid partial matches)
    const sortedCompanies = [...this.companyNames].sort(
      (a, b) => b.length - a.length,
    );
    for (const name of sortedCompanies) {
      if (name.length < 3) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'gi'), '[CLIENT]');
    }

    // Replace contact full names first, then individual first/last names
    const sortedContacts = [...this.contactNames].sort(
      (a, b) => b.length - a.length,
    );
    for (const name of sortedContacts) {
      if (name.length < 3) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '[USER]');
    }

    // Replace regex-based PII patterns
    result = result.replace(PII_PATTERNS.email, '[EMAIL]');
    result = result.replace(PII_PATTERNS.passwordField, '[PASSWORD_REDACTED]');
    result = result.replace(PII_PATTERNS.apiKey, (match) => {
      // Only replace if it looks like a real key (not a normal word)
      if (match.length >= 40 || /[A-Z].*[0-9]|[0-9].*[A-Z]/.test(match)) {
        return '[API_KEY]';
      }
      return match;
    });
    result = result.replace(PII_PATTERNS.ipv4, (match) => {
      // Preserve common private ranges as-is? No — anonymise all IPs
      return '[IP_ADDRESS]';
    });
    result = result.replace(PII_PATTERNS.phone, (match) => {
      // Only replace if it looks like a real phone number (7+ digits)
      const digits = match.replace(/\D/g, '');
      if (digits.length >= 7) return '[PHONE]';
      return match;
    });

    return result;
  }

  // ─── Ticket Sync ──────────────────────────────────────────────────

  /**
   * Sync closed tickets from CW into the resolution KB.
   * Pulls tickets closed since the last sync cursor.
   */
  async syncClosedTickets(options?: {
    since?: Date;
    limit?: number;
    dryRun?: boolean;
  }): Promise<{ synced: number; skipped: number; errors: number }> {
    const { limit = 100, dryRun = false } = options || {};

    // Get sync state
    let syncState = await this.prisma.resolutionSyncState.findUnique({
      where: { id: 'singleton' },
    });

    const since =
      options?.since ||
      syncState?.lastSyncAt ||
      new Date('2024-01-01T00:00:00Z'); // Default: last 2 years

    this.logger.log(
      `Syncing closed tickets since ${since.toISOString()} (limit: ${limit}, dryRun: ${dryRun})`,
    );

    let stats = { synced: 0, skipped: 0, errors: 0 };
    let page = 1;
    let latestClosedDate = since;

    // Only sync from the 6 triage boards
    const boardIds = [51, 54, 56, 53, 57, 58];
    const boardCondition = boardIds.map((id) => `board/id=${id}`).join(' OR ');

    while (stats.synced + stats.skipped < limit) {
      const pageSize = Math.min(50, limit - stats.synced - stats.skipped);

      let tickets: ClosedTicket[];
      try {
        tickets = await this.cw.request({
          path: '/service/tickets',
          method: 'get',
          params: {
            conditions: `closedDate > [${since.toISOString()}] AND (${boardCondition})`,
            fields:
              'id,summary,board,type,subType,item,company,contact,closedDate,actualHours',
            orderBy: 'closedDate asc',
            pageSize,
            page,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to fetch tickets page ${page}: ${err.message}`);
        break;
      }

      if (!tickets || tickets.length === 0) break;

      for (const ticket of tickets) {
        try {
          // Check if already ingested
          const existing = await this.prisma.$queryRawUnsafe(
            `SELECT id FROM resolution_entries WHERE "ticketId" = $1 LIMIT 1`,
            ticket.id,
          ) as any[];
          if (existing.length > 0) {
            stats.skipped++;
            continue;
          }

          if (dryRun) {
            stats.synced++;
            continue;
          }

          await this.ingestTicket(ticket);
          stats.synced++;

          // Rate-limit: small delay between tickets to avoid hammering CW/NVIDIA APIs
          await new Promise((r) => setTimeout(r, 500));

          const closedAt = new Date(ticket.closedDate);
          if (closedAt > latestClosedDate) latestClosedDate = closedAt;
        } catch (err) {
          this.logger.error(
            `Failed to ingest ticket #${ticket.id}: ${err.message}`,
          );
          stats.errors++;
        }
      }

      if (tickets.length < pageSize) break;
      page++;
    }

    // Update sync state
    if (!dryRun && stats.synced > 0) {
      await this.prisma.resolutionSyncState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          lastSyncAt: latestClosedDate,
          totalSynced: stats.synced,
          lastRunAt: new Date(),
        },
        update: {
          lastSyncAt: latestClosedDate,
          totalSynced: { increment: stats.synced },
          lastRunAt: new Date(),
        },
      });
    }

    this.logger.log(
      `Sync complete: ${stats.synced} synced, ${stats.skipped} skipped, ${stats.errors} errors`,
    );
    return stats;
  }

  /**
   * Ingest a single closed ticket into the KB.
   * Reads ALL notes, initial description, and resolution — then uses LLM
   * to generate a clean problem/resolution summary.
   */
  private async ingestTicket(ticket: ClosedTicket): Promise<void> {
    // Fetch the full ticket context: initial description + ALL notes
    const { initialDescription, allNotes, resolutionNote } =
      await this.getFullTicketContext(ticket.id);

    // Use LLM to generate a clean problem/resolution summary from all context
    const { problemSummary, resolutionSummary, correctedSummary } =
      await this.generateTicketSummary(ticket, initialDescription, allNotes, resolutionNote);

    // Optionally update the CW ticket summary if it was poor
    if (correctedSummary && correctedSummary !== ticket.summary) {
      await this.updateTicketSummary(ticket.id, correctedSummary);
    }

    // Anonymise all text
    const anonProblem = this.anonymise(problemSummary);
    const anonResolution = this.anonymise(resolutionSummary);
    const effectiveSummary = correctedSummary || ticket.summary;
    const anonSummary = this.anonymise(effectiveSummary);

    // Build combined text for embedding
    const parts = [
      `Summary: ${anonSummary}`,
      `Problem: ${anonProblem}`,
      anonResolution ? `Resolution: ${anonResolution}` : null,
      ticket.type?.name ? `Type: ${ticket.type.name}` : null,
      ticket.subType?.name ? `Subtype: ${ticket.subType.name}` : null,
      ticket.item?.name ? `Item: ${ticket.item.name}` : null,
    ].filter(Boolean);

    const combinedText = parts.join('\n');

    // Generate embedding
    const embedding = await this.nvidia.createEmbedding(combinedText, {
      inputType: 'passage',
    });

    const closedAt = new Date(ticket.closedDate);
    const minutesToResolve = ticket.actualHours
      ? Math.round(ticket.actualHours * 60)
      : null;

    // Insert using raw SQL because Prisma can't handle Unsupported vector type
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO resolution_entries (
        id, "ticketId", "ticketSummary", "closedAt",
        board, type, subtype, item,
        summary, description, resolution, "combinedText",
        "minutesToResolve", embedding, "embeddingModel",
        "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3,
        $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13::vector, $14,
        NOW(), NOW()
      )`,
      ticket.id,
      effectiveSummary,
      closedAt,
      ticket.board?.name || null,
      ticket.type?.name || null,
      ticket.subType?.name || null,
      ticket.item?.name || null,
      anonProblem,
      null, // description field — replaced by problemSummary
      anonResolution || null,
      combinedText,
      minutesToResolve,
      `[${embedding.join(',')}]`,
      DEFAULT_EMBEDDING_MODEL,
    );

    this.logger.debug(
      `Ingested ticket #${ticket.id}: "${anonSummary.substring(0, 60)}..."`,
    );
  }

  /**
   * Get FULL ticket context: initial description, ALL notes, and resolution note.
   * Engineers often bury resolution info in random notes — we need everything.
   */
  private async getFullTicketContext(ticketId: number): Promise<{
    initialDescription: string;
    allNotes: string[];
    resolutionNote: string;
  }> {
    let initialDescription = '';
    let allNotes: string[] = [];
    let resolutionNote = '';

    try {
      // Get initial description
      const ticket = await this.cw.request({
        path: `/service/tickets/${ticketId}`,
        method: 'get',
        params: { fields: 'id,initialDescription,resolveMinutes' },
      });
      initialDescription = ticket?.initialDescription || '';
    } catch {
      // Continue without description
    }

    try {
      // Get ALL notes — internal, external, resolution
      let page = 1;
      while (true) {
        const notes = await this.cw.request({
          path: `/service/tickets/${ticketId}/notes`,
          method: 'get',
          params: {
            orderBy: 'id asc',
            pageSize: 200,
            page,
          },
        });

        if (!notes || notes.length === 0) break;

        for (const note of notes as any[]) {
          if (!note.text) continue;
          // Skip Oracle auto-triage notes
          if (note.text.includes('Oracle Auto-Triage')) continue;

          if (note.resolutionFlag) {
            resolutionNote = note.text.trim();
          } else {
            allNotes.push(note.text.trim());
          }
        }

        if (notes.length < 200) break;
        page++;
      }
    } catch {
      // Continue with what we have
    }

    return { initialDescription, allNotes, resolutionNote };
  }

  /**
   * Use LLM to generate a clean problem/resolution summary from the full ticket.
   * Also generates a corrected summary line if the original was poor.
   */
  private async generateTicketSummary(
    ticket: ClosedTicket,
    initialDescription: string,
    allNotes: string[],
    resolutionNote: string,
  ): Promise<{
    problemSummary: string;
    resolutionSummary: string;
    correctedSummary: string | null;
  }> {
    // Truncate notes to avoid exceeding token limits
    const notesText = allNotes
      .map((n, i) => `Note ${i + 1}: ${n}`)
      .join('\n')
      .substring(0, 6000);

    const systemPrompt = `You are a technical analyst for an IT managed service provider (MSP).
Your job is to read a closed support ticket and produce:
1. A clear PROBLEM SUMMARY (what was actually wrong — not what the customer initially said, but the diagnosed root cause)
2. A clear RESOLUTION SUMMARY (what was done to fix it — specific steps, not vague descriptions)
3. A CORRECTED SUMMARY (a concise, accurate one-line ticket subject that reflects the actual issue)

Rules:
- Be technical and specific (e.g., "Dell Latitude 5540 webcam hardware failure" not "laptop camera issue")
- Include model numbers, software names, error codes when available in the notes
- The resolution must describe what actually fixed it, not just troubleshooting steps that were tried
- The corrected summary should be what the ticket SHOULD have been called — max 80 chars
- If the original summary is already accurate, set correctedSummary to null
- Do NOT include any client names, contact names, or identifying information

Respond in JSON only:
{
  "problemSummary": "...",
  "resolutionSummary": "...",
  "correctedSummary": "..." or null
}`;

    const userPrompt = `Original Summary: ${ticket.summary}
Board: ${ticket.board?.name || 'Unknown'}
Type: ${ticket.type?.name || 'N/A'} > ${ticket.subType?.name || 'N/A'} > ${ticket.item?.name || 'N/A'}

Initial Description:
${initialDescription || 'None'}

${resolutionNote ? `Resolution Note:\n${resolutionNote}\n` : ''}
Ticket Notes (chronological):
${notesText || 'No notes'}`;

    try {
      const modelOverride = this.config.get<string>(
        'TRIAGE_MODEL',
        'moonshotai/kimi-k2-instruct',
      );
      const completion = await this.nvidia.createChatCompletion(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.2, maxTokens: 1024 },
        modelOverride,
      );

      const responseText =
        completion.choices[0]?.message?.content?.trim() || '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          problemSummary: parsed.problemSummary || ticket.summary,
          resolutionSummary: parsed.resolutionSummary || '',
          correctedSummary: parsed.correctedSummary || null,
        };
      }
    } catch (err) {
      this.logger.warn(
        `LLM summary generation failed for ticket #${ticket.id}: ${err.message}`,
      );
    }

    // Fallback: use raw data
    return {
      problemSummary: ticket.summary,
      resolutionSummary: resolutionNote || allNotes[allNotes.length - 1] || '',
      correctedSummary: null,
    };
  }

  /**
   * Update a CW ticket's summary (subject line) with a corrected version.
   * Only runs on closed tickets during KB ingestion.
   */
  private async updateTicketSummary(
    ticketId: number,
    newSummary: string,
  ): Promise<void> {
    try {
      await this.cw.request({
        path: `/service/tickets/${ticketId}`,
        method: 'patch',
        data: [{ op: 'replace', path: 'summary', value: newSummary }],
      });
      this.logger.log(
        `Updated ticket #${ticketId} summary to: "${newSummary}"`,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to update summary for ticket #${ticketId}: ${err.message}`,
      );
    }
  }

  // ─── Similarity Search ────────────────────────────────────────────

  /**
   * Search the resolution KB for similar past tickets.
   * Uses cosine similarity on NVIDIA embeddings.
   */
  async searchSimilar(
    query: string,
    options?: {
      limit?: number;
      minSimilarity?: number;
      board?: string;
      type?: string;
    },
  ): Promise<SimilarResolution[]> {
    const { limit = 5, minSimilarity = 0.15, board, type } = options || {};

    // Generate query embedding
    const queryEmbedding = await this.nvidia.createEmbedding(query, {
      inputType: 'query',
    });

    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: any[] = [embeddingStr, limit];
    let paramIdx = 3;

    if (board) {
      conditions.push(`board = $${paramIdx}`);
      params.push(board);
      paramIdx++;
    }
    if (type) {
      conditions.push(`type = $${paramIdx}`);
      params.push(type);
      paramIdx++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const results = await this.prisma.$queryRawUnsafe(
      `SELECT
        "ticketId",
        summary,
        resolution,
        board,
        type,
        subtype,
        item,
        "minutesToResolve",
        "closedAt",
        1 - (embedding <=> $1::vector) AS similarity
      FROM resolution_entries
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT $2`,
      ...params,
    ) as SimilarResolution[];

    // Filter by minimum similarity
    return results.filter((r) => Number(r.similarity) >= minSimilarity);
  }

  /**
   * Format similar resolutions for inclusion in a triage note.
   * This is what gets appended to the internal note for engineers.
   */
  formatForTriageNote(results: SimilarResolution[]): string {
    if (results.length === 0) return '';

    const lines = [
      '',
      '📚 Similar Past Resolutions (from Knowledge Base):',
      '───────────────────────────────────────────────────',
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const similarity = (Number(r.similarity) * 100).toFixed(0);
      const timeStr = r.minutesToResolve
        ? ` (resolved in ${r.minutesToResolve}min)`
        : '';

      lines.push(
        ``,
        `${i + 1}. [${similarity}% match] ${r.summary}${timeStr}`,
        `   📋 ${r.board || 'N/A'} > ${r.type || 'N/A'} > ${r.subtype || 'N/A'} > ${r.item || 'N/A'}`,
        `   🔗 Ticket #${r.ticketId}`,
      );

      if (r.resolution) {
        // Truncate long resolutions
        const res =
          r.resolution.length > 300
            ? r.resolution.substring(0, 300) + '...'
            : r.resolution;
        lines.push(`   💡 Resolution: ${res}`);
      }
    }

    return lines.join('\n');
  }

  // ─── Admin / Status ───────────────────────────────────────────────

  /**
   * Get KB stats
   */
  async getStats(): Promise<{
    totalEntries: number;
    syncState: any;
    boardBreakdown: { board: string; count: number }[];
  }> {
    const totalEntries = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as count FROM resolution_entries`,
    ) as any[];

    const syncState = await this.prisma.resolutionSyncState.findUnique({
      where: { id: 'singleton' },
    });

    const boardBreakdown = await this.prisma.$queryRawUnsafe(
      `SELECT board, COUNT(*)::int as count FROM resolution_entries GROUP BY board ORDER BY count DESC`,
    ) as any[];

    return {
      totalEntries: totalEntries[0]?.count || 0,
      syncState,
      boardBreakdown,
    };
  }
}
