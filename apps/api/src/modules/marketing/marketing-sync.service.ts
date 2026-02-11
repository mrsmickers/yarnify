import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConnectwiseContactsService,
  CWContact,
} from './connectwise-contacts.service';
import { EnchargeService, EnchargePerson } from './encharge.service';
import { UpdateSyncDto, GetSyncRunsQueryDto } from './dto/marketing-sync.dto';

@Injectable()
export class MarketingSyncService {
  private readonly logger = new Logger(MarketingSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cwContacts: ConnectwiseContactsService,
    private readonly encharge: EnchargeService,
  ) {}

  async listSyncs() {
    const syncs = await this.prisma.marketingSync.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    return syncs;
  }

  async getSyncById(id: string) {
    const sync = await this.prisma.marketingSync.findUnique({
      where: { id },
      include: {
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!sync) throw new NotFoundException(`Sync ${id} not found`);
    return sync;
  }

  async updateSync(id: string, dto: UpdateSyncDto) {
    const sync = await this.prisma.marketingSync.findUnique({
      where: { id },
    });
    if (!sync) throw new NotFoundException(`Sync ${id} not found`);

    return this.prisma.marketingSync.update({
      where: { id },
      data: {
        ...(dto.schedule !== undefined && { schedule: dto.schedule }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      },
    });
  }

  async getSyncRuns(id: string, query: GetSyncRunsQueryDto) {
    const sync = await this.prisma.marketingSync.findUnique({
      where: { id },
    });
    if (!sync) throw new NotFoundException(`Sync ${id} not found`);

    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      this.prisma.marketingSyncRun.findMany({
        where: { syncId: id },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.marketingSyncRun.count({ where: { syncId: id } }),
    ]);

    return { data: runs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getSyncRunById(syncId: string, runId: string) {
    const run = await this.prisma.marketingSyncRun.findFirst({
      where: { id: runId, syncId },
    });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    return run;
  }

  /**
   * Execute the full sync: CW contacts → Encharge.
   */
  async executeSync(
    syncId: string,
    triggeredBy: 'manual' | 'schedule',
  ): Promise<string> {
    const sync = await this.prisma.marketingSync.findUnique({
      where: { id: syncId },
    });
    if (!sync) throw new NotFoundException(`Sync ${syncId} not found`);

    // Create run record
    const run = await this.prisma.marketingSyncRun.create({
      data: {
        syncId,
        status: 'running',
        triggeredBy,
      },
    });

    try {
      // 1. Pull CW contacts
      const filterConfig = sync.filterConfig as any;
      const cwContacts = await this.cwContacts.getContactsForSync(filterConfig);
      this.logger.log(
        `[Sync ${syncId}] Pulled ${cwContacts.length} contacts from ConnectWise`,
      );

      // 2. Pull Encharge contacts
      const enchargeContacts = await this.encharge.getAllPeople();
      this.logger.log(
        `[Sync ${syncId}] Pulled ${enchargeContacts.length} contacts from Encharge`,
      );

      // Build lookup: email (lowercase) → Encharge person
      const enchargeMap = new Map<string, EnchargePerson>();
      for (const person of enchargeContacts) {
        if (person.email) {
          enchargeMap.set(person.email.toLowerCase(), person);
        }
      }

      // Track emails we process from CW so we can detect removals later
      const cwEmails = new Set<string>();

      let created = 0;
      let updated = 0;
      let skipped = 0;
      let failed = 0;

      // 3-4. Process each CW contact
      for (const cwContact of cwContacts) {
        const email = cwContact.email!.toLowerCase();
        cwEmails.add(email);

        try {
          const existing = enchargeMap.get(email);

          if (existing) {
            // Check if update needed (name or company changed)
            const needsUpdate =
              existing.firstName !== cwContact.firstName ||
              existing.lastName !== cwContact.lastName ||
              existing.company !== (cwContact.company?.name ?? '');

            if (needsUpdate) {
              await this.encharge.upsertPerson({
                email: cwContact.email!,
                firstName: cwContact.firstName,
                lastName: cwContact.lastName,
                company: cwContact.company?.name ?? '',
              });
              updated++;
            } else {
              skipped++;
            }

            // Ensure tag is applied
            const tags = (existing.tags ?? '').split(',').map((t) => t.trim().toLowerCase());
            if (!tags.includes(sync.tagName.toLowerCase())) {
              await this.encharge.addTag(cwContact.email!, sync.tagName);
            }
          } else {
            // New contact: create in Encharge with tag
            await this.encharge.upsertPerson({
              email: cwContact.email!,
              firstName: cwContact.firstName,
              lastName: cwContact.lastName,
              company: cwContact.company?.name ?? '',
              tags: sync.tagName,
            });
            created++;
          }
        } catch (err) {
          this.logger.error(
            `[Sync ${syncId}] Failed to process contact ${cwContact.email}: ${err.message}`,
          );
          failed++;
        }
      }

      // 5. Remove tag from Encharge contacts that have the tag but are NOT in CW results
      let removed = 0;
      for (const person of enchargeContacts) {
        if (!person.email) continue;
        const personEmail = person.email.toLowerCase();
        const tags = (person.tags ?? '')
          .split(',')
          .map((t) => t.trim().toLowerCase());

        if (tags.includes(sync.tagName.toLowerCase()) && !cwEmails.has(personEmail)) {
          try {
            await this.encharge.removeTag(person.email, sync.tagName);
            removed++;
          } catch (err) {
            this.logger.error(
              `[Sync ${syncId}] Failed to remove tag from ${person.email}: ${err.message}`,
            );
            failed++;
          }
        }
      }

      // 6. Update run record
      await this.prisma.marketingSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          contactsTotal: cwContacts.length,
          contactsCreated: created,
          contactsUpdated: updated,
          contactsRemoved: removed,
          contactsSkipped: skipped,
          contactsFailed: failed,
        },
      });

      this.logger.log(
        `[Sync ${syncId}] Completed — total: ${cwContacts.length}, created: ${created}, updated: ${updated}, removed: ${removed}, skipped: ${skipped}, failed: ${failed}`,
      );

      return run.id;
    } catch (err) {
      this.logger.error(
        `[Sync ${syncId}] Run failed: ${err.message}`,
        err.stack,
      );

      await this.prisma.marketingSyncRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: err.message,
        },
      });

      return run.id;
    }
  }
}
