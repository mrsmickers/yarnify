import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditLog, Prisma } from '@db';

export interface LogParams {
  actorId?: string;
  actorEmail?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
}

export interface LogFilters {
  startDate?: Date;
  endDate?: Date;
  actorId?: string;
  action?: string;
  targetType?: string;
  limit?: number;
  offset?: number;
}

export interface ActionStats {
  action: string;
  count: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Log an audit event. Fire-and-forget — doesn't block the caller.
   */
  async log(params: LogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          actorEmail: params.actorEmail,
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          targetName: params.targetName,
          metadata: params.metadata as Prisma.InputJsonValue,
        },
      });
      this.logger.debug(
        `Audit log: ${params.action} by ${params.actorEmail || 'system'} on ${params.targetType || 'N/A'}:${params.targetId || 'N/A'}`,
      );
    } catch (error) {
      // Log error but don't throw — audit logging should never break business logic
      this.logger.error('Failed to create audit log', error);
    }
  }

  /**
   * Get paginated audit logs with optional filters.
   */
  async getLogs(filters: LogFilters): Promise<{ logs: AuditLog[]; total: number }> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.startDate) {
      where.timestamp = { ...where.timestamp as object, gte: filters.startDate };
    }
    if (filters.endDate) {
      where.timestamp = { ...where.timestamp as object, lte: filters.endDate };
    }
    if (filters.actorId) {
      where.actorId = filters.actorId;
    }
    if (filters.action) {
      where.action = { contains: filters.action, mode: 'insensitive' };
    }
    if (filters.targetType) {
      where.targetType = filters.targetType;
    }

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              displayName: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  /**
   * Get audit logs for a specific target (e.g., all views of a specific call).
   */
  async getLogsByTarget(targetType: string, targetId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { targetType, targetId },
      orderBy: { timestamp: 'desc' },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });
  }

  /**
   * Get action statistics for dashboard widget.
   */
  async getStats(since?: Date): Promise<ActionStats[]> {
    const where: Prisma.AuditLogWhereInput = {};
    if (since) {
      where.timestamp = { gte: since };
    }

    const stats = await this.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { action: true },
      where,
      orderBy: { _count: { action: 'desc' } },
      take: 20,
    });

    return stats.map((s) => ({
      action: s.action,
      count: s._count.action,
    }));
  }

  /**
   * Get recent activity for a specific user.
   */
  async getRecentActivityByUser(
    userId: string,
    limit = 10,
  ): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { actorId: userId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
}
