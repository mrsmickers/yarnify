import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID } from 'crypto';

// Extended Call type with new grouping fields (until Prisma client is regenerated)
interface CallWithGrouping {
  id: string;
  callSid: string;
  startTime: Date;
  endTime: Date | null;
  callStatus: string;
  callerIdInternal: string | null;
  callGroupId: string | null;
  callLegOrder: number | null;
  [key: string]: unknown;
}

/**
 * Service for grouping related calls (transfers, queue routing, etc.)
 * 
 * Calls are grouped when they share the same callerIdInternal (the original
 * external caller's number) and have overlapping or adjacent time windows.
 */
@Injectable()
export class CallGroupingService {
  private readonly logger = new Logger(CallGroupingService.name);

  // Maximum gap between calls to consider them part of the same group (5 minutes)
  private readonly MAX_GAP_SECONDS = 300;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * After a call is processed, check if it should be grouped with other calls.
   * Groups calls by callerIdInternal within overlapping/adjacent time windows.
   */
  async groupCallIfNeeded(callId: string): Promise<void> {
    // @ts-ignore - new fields not in Prisma types yet
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
    }) as CallWithGrouping | null;

    if (!call) {
      this.logger.warn(`Call ${callId} not found for grouping`);
      return;
    }

    // Skip if no callerIdInternal (can't group without it)
    if (!call.callerIdInternal) {
      this.logger.debug(`Call ${callId} has no callerIdInternal, skipping grouping`);
      return;
    }

    // Skip internal-only calls (callerIdInternal is an extension)
    if (this.isInternalExtension(call.callerIdInternal)) {
      this.logger.debug(`Call ${callId} has internal callerIdInternal, skipping grouping`);
      return;
    }

    // Find related calls with same callerIdInternal within time window
    const relatedCalls = await this.findRelatedCalls(call);

    if (relatedCalls.length === 0) {
      this.logger.debug(`No related calls found for ${callId}`);
      return;
    }

    // Include the current call in the group
    const allCallsInGroup = [call, ...relatedCalls];

    // Determine the group ID (use existing if any call has one, otherwise generate new)
    let groupId = allCallsInGroup.find(c => c.callGroupId)?.callGroupId;
    if (!groupId) {
      groupId = `grp_${randomUUID().substring(0, 8)}`;
    }

    // Sort by start time to determine leg order
    allCallsInGroup.sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    // Update all calls with group ID and leg order
    for (let i = 0; i < allCallsInGroup.length; i++) {
      const c = allCallsInGroup[i];
      if (c.callGroupId !== groupId || c.callLegOrder !== i + 1) {
        // @ts-ignore - new fields not in Prisma types yet
        await this.prisma.call.update({
          where: { id: c.id },
          data: {
            callGroupId: groupId,
            callLegOrder: i + 1,
          } as any,
        });
      }
    }

    this.logger.log(
      `Grouped ${allCallsInGroup.length} calls under ${groupId}: ` +
      allCallsInGroup.map(c => c.callSid).join(', ')
    );
  }

  /**
   * Find calls that are related to the given call (same callerIdInternal, overlapping time)
   */
  private async findRelatedCalls(call: CallWithGrouping): Promise<CallWithGrouping[]> {
    const callStart = new Date(call.startTime);
    const callEnd = call.endTime ? new Date(call.endTime) : new Date();

    // Expand time window by MAX_GAP_SECONDS on both sides
    const windowStart = new Date(callStart.getTime() - this.MAX_GAP_SECONDS * 1000);
    const windowEnd = new Date(callEnd.getTime() + this.MAX_GAP_SECONDS * 1000);

    // @ts-ignore - new fields not in Prisma types yet
    const relatedCalls = await this.prisma.call.findMany({
      where: {
        id: { not: call.id },
        callerIdInternal: call.callerIdInternal,
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
        // Exclude failed/cancelled calls
        callStatus: { notIn: ['FAILED', 'CANCELLED'] },
      } as any,
      orderBy: { startTime: 'asc' },
    }) as CallWithGrouping[];

    // Filter to only calls that actually overlap or are adjacent
    return relatedCalls.filter(c => this.callsAreRelated(call, c));
  }

  /**
   * Check if two calls are related (overlapping or adjacent in time)
   */
  private callsAreRelated(call1: CallWithGrouping, call2: CallWithGrouping): boolean {
    const start1 = new Date(call1.startTime).getTime();
    const end1 = call1.endTime ? new Date(call1.endTime).getTime() : Date.now();
    const start2 = new Date(call2.startTime).getTime();
    const end2 = call2.endTime ? new Date(call2.endTime).getTime() : Date.now();

    // Check for overlap
    if (start1 <= end2 && start2 <= end1) {
      return true;
    }

    // Check for adjacency (gap less than MAX_GAP_SECONDS)
    const gap = Math.min(
      Math.abs(start1 - end2),
      Math.abs(start2 - end1)
    );

    return gap <= this.MAX_GAP_SECONDS * 1000;
  }

  /**
   * Check if a number is an internal extension (starts with 56360)
   */
  private isInternalExtension(number: string): boolean {
    return /^56360\d+$/.test(number);
  }

  /**
   * Get all calls in a group
   */
  async getCallGroup(groupId: string): Promise<any[]> {
    // @ts-ignore - new fields not in Prisma types yet
    return this.prisma.call.findMany({
      where: { callGroupId: groupId } as any,
      orderBy: { callLegOrder: 'asc' } as any,
      include: {
        Agents: true,
        analysis: true,
        company: true,
      },
    });
  }

  /**
   * Manually link two calls into the same group
   */
  async linkCalls(callId1: string, callId2: string): Promise<string> {
    const call1 = await this.prisma.call.findUnique({ where: { id: callId1 } }) as unknown as CallWithGrouping | null;
    const call2 = await this.prisma.call.findUnique({ where: { id: callId2 } }) as unknown as CallWithGrouping | null;

    if (!call1 || !call2) {
      throw new Error('One or both calls not found');
    }

    // Use existing group ID or create new one
    const groupId = call1.callGroupId || call2.callGroupId || `grp_${randomUUID().substring(0, 8)}`;

    // Sort by start time
    const sorted = [call1, call2].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    for (let i = 0; i < sorted.length; i++) {
      // @ts-ignore - new fields not in Prisma types yet
      await this.prisma.call.update({
        where: { id: sorted[i].id },
        data: {
          callGroupId: groupId,
          callLegOrder: i + 1,
        } as any,
      });
    }

    return groupId;
  }

  /**
   * Remove a call from its group
   */
  async unlinkCall(callId: string): Promise<void> {
    // @ts-ignore - new fields not in Prisma types yet
    await this.prisma.call.update({
      where: { id: callId },
      data: {
        callGroupId: null,
        callLegOrder: null,
      } as any,
    });
  }
}
