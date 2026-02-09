import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentAccessService } from '../agent-access/agent-access.service';
import { Prisma } from '@db';

interface DateRange {
  startDate?: string;
  endDate?: string;
}

interface UserContext {
  role: string;
  userId: string;
  entraUserId?: string;
  department?: string | null;
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly agentAccessService: AgentAccessService,
  ) {}

  /**
   * Look up the user's role, department, and ID from EntraUser table
   */
  async getUserContext(
    oid: string,
  ): Promise<{ id: string; role: string; department: string | null; entraUserId: string } | null> {
    const user = await this.db.entraUser.findUnique({
      where: { oid },
      select: { id: true, role: true, department: true },
    });
    return user ? { id: user.id, role: user.role, department: user.department, entraUserId: user.id } : null;
  }

  /**
   * Build the agent-based where clause for scoping calls by user access
   */
  private async buildScopedWhere(
    dateRange: DateRange,
    userContext?: UserContext,
  ): Promise<Prisma.CallWhereInput> {
    const where: Prisma.CallWhereInput = {
      callStatus: { notIn: ['INTERNAL_CALL_SKIPPED'] },
    };

    // Date range filtering
    if (dateRange.startDate || dateRange.endDate) {
      where.startTime = {};
      if (dateRange.startDate) {
        (where.startTime as Prisma.DateTimeFilter).gte = new Date(
          dateRange.startDate,
        );
      }
      if (dateRange.endDate) {
        (where.startTime as Prisma.DateTimeFilter).lte = new Date(
          dateRange.endDate,
        );
      }
    }

    // Agent-based access control
    if (userContext && userContext.role !== 'admin') {
      const entraUserId = userContext.entraUserId;
      if (entraUserId) {
        const accessibleAgentIds = await this.agentAccessService.getAccessibleAgentIds(entraUserId);
        
        if (accessibleAgentIds.length === 0) {
          // User has no agent access — return impossible condition
          where.id = { equals: 'NO_ACCESS' };
        } else {
          // Filter to only accessible agents
          where.agentsId = { in: accessibleAgentIds };
        }
      } else {
        // Fallback to OID-based lookup for backward compatibility
        where.Agents = {
          entraUser: { oid: userContext.userId },
        };
      }
    }

    return where;
  }

  /**
   * Overview stats: total calls, avg sentiment, avg confidence, calls by direction, top agents
   */
  async getOverviewStats(dateRange: DateRange, userContext?: UserContext) {
    const where = await this.buildScopedWhere(dateRange, userContext);

    // Total calls & duration
    const callAgg = await this.db.call.aggregate({
      where,
      _count: { id: true },
      _sum: { duration: true },
    });

    // Calls by direction
    const callsByDirection = await this.db.call.groupBy({
      by: ['callDirection'],
      where,
      _count: { id: true },
    });

    // Get all calls with analysis for sentiment/confidence aggregation
    const callsWithAnalysis = await this.db.call.findMany({
      where: {
        ...where,
        analysis: { isNot: null },
      },
      select: {
        analysis: {
          select: { data: true },
        },
      },
    });

    // Aggregate sentiment & confidence from JSON data
    let totalSentimentScore = 0;
    let totalConfidenceScore = 0;
    let analysisCount = 0;

    const sentimentScoreMap: Record<string, number> = {
      Positive: 1,
      Neutral: 0.5,
      Negative: 0,
      Undetermined: 0.5,
    };
    const confidenceScoreMap: Record<string, number> = {
      High: 1,
      Medium: 0.66,
      Low: 0.33,
      Undetermined: 0.5,
    };

    for (const call of callsWithAnalysis) {
      const data = call.analysis?.data as Record<string, unknown> | null;
      if (!data) continue;
      analysisCount++;

      const sentiment = data.sentiment as string;
      const confidence = data.confidence_level as string;

      totalSentimentScore += sentimentScoreMap[sentiment] ?? 0.5;
      totalConfidenceScore += confidenceScoreMap[confidence] ?? 0.5;
    }

    // Top agents (by call count)
    const topAgents = await this.db.call.groupBy({
      by: ['agentsId'],
      where: {
        ...where,
        agentsId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    // Resolve agent names
    const agentIds = topAgents
      .map((a) => a.agentsId)
      .filter((id): id is string => id !== null);
    const agents = await this.db.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    return {
      totalCalls: callAgg._count.id,
      totalDuration: callAgg._sum.duration ?? 0,
      avgSentiment:
        analysisCount > 0 ? totalSentimentScore / analysisCount : null,
      avgConfidence:
        analysisCount > 0 ? totalConfidenceScore / analysisCount : null,
      callsByDirection: callsByDirection.map((d) => ({
        direction: d.callDirection ?? 'UNKNOWN',
        count: d._count.id,
      })),
      topAgents: topAgents.map((a) => ({
        agentId: a.agentsId,
        agentName: agentMap.get(a.agentsId!) ?? 'Unknown',
        callCount: a._count.id,
      })),
    };
  }

  /**
   * Sentiment breakdown: count by sentiment value
   */
  async getSentimentBreakdown(dateRange: DateRange, userContext?: UserContext) {
    const where = await this.buildScopedWhere(dateRange, userContext);

    const callsWithAnalysis = await this.db.call.findMany({
      where: {
        ...where,
        analysis: { isNot: null },
      },
      select: {
        analysis: {
          select: { data: true },
        },
      },
    });

    const breakdown: Record<string, number> = {
      Positive: 0,
      Neutral: 0,
      Negative: 0,
      Undetermined: 0,
    };

    for (const call of callsWithAnalysis) {
      const data = call.analysis?.data as Record<string, unknown> | null;
      if (!data) continue;
      const sentiment = (data.sentiment as string) || 'Undetermined';
      breakdown[sentiment] = (breakdown[sentiment] || 0) + 1;
    }

    return Object.entries(breakdown).map(([sentiment, count]) => ({
      sentiment,
      count,
    }));
  }

  /**
   * Call volume trend: calls per day/week
   */
  async getCallVolumeTrend(
    dateRange: DateRange,
    granularity: 'day' | 'week' = 'day',
    userContext?: UserContext,
  ) {
    const where = await this.buildScopedWhere(dateRange, userContext);

    const calls = await this.db.call.findMany({
      where,
      select: { startTime: true },
      orderBy: { startTime: 'asc' },
    });

    // Group by date
    const volumeMap = new Map<string, number>();

    for (const call of calls) {
      let key: string;
      const date = new Date(call.startTime);
      if (granularity === 'week') {
        // ISO week start (Monday)
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        key = d.toISOString().split('T')[0];
      } else {
        key = date.toISOString().split('T')[0];
      }
      volumeMap.set(key, (volumeMap.get(key) || 0) + 1);
    }

    return Array.from(volumeMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
  }

  /**
   * Agent performance: calls per agent, avg sentiment per agent
   */
  async getAgentPerformance(dateRange: DateRange, userContext?: UserContext) {
    const where = await this.buildScopedWhere(dateRange, userContext);

    const calls = await this.db.call.findMany({
      where: {
        ...where,
        agentsId: { not: null },
      },
      select: {
        agentsId: true,
        analysis: {
          select: { data: true },
        },
      },
    });

    const sentimentScoreMap: Record<string, number> = {
      Positive: 1,
      Neutral: 0.5,
      Negative: 0,
      Undetermined: 0.5,
    };

    // Group by agent
    const agentStats = new Map<
      string,
      { callCount: number; sentimentTotal: number; sentimentCount: number }
    >();

    for (const call of calls) {
      const agentId = call.agentsId!;
      if (!agentStats.has(agentId)) {
        agentStats.set(agentId, {
          callCount: 0,
          sentimentTotal: 0,
          sentimentCount: 0,
        });
      }
      const stats = agentStats.get(agentId)!;
      stats.callCount++;

      const data = call.analysis?.data as Record<string, unknown> | null;
      if (data?.sentiment) {
        stats.sentimentTotal +=
          sentimentScoreMap[data.sentiment as string] ?? 0.5;
        stats.sentimentCount++;
      }
    }

    // Resolve agent names
    const agentIds = Array.from(agentStats.keys());
    const agents = await this.db.agent.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a.name]));

    return Array.from(agentStats.entries())
      .map(([agentId, stats]) => ({
        agentId,
        agentName: agentMap.get(agentId) ?? 'Unknown',
        callCount: stats.callCount,
        avgSentiment:
          stats.sentimentCount > 0
            ? stats.sentimentTotal / stats.sentimentCount
            : null,
      }))
      .sort((a, b) => b.callCount - a.callCount);
  }

  /**
   * Top companies: most frequent callers
   */
  async getTopCompanies(
    dateRange: DateRange,
    limit = 10,
    userContext?: UserContext,
  ) {
    const where = await this.buildScopedWhere(dateRange, userContext);

    const companyGroups = await this.db.call.groupBy({
      by: ['companyId'],
      where: {
        ...where,
        companyId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Resolve company names
    const companyIds = companyGroups
      .map((c) => c.companyId)
      .filter((id): id is string => id !== null);
    const companies = await this.db.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });
    const companyMap = new Map(companies.map((c) => [c.id, c.name]));

    return companyGroups.map((c) => ({
      companyId: c.companyId,
      companyName: companyMap.get(c.companyId!) ?? 'Unknown',
      callCount: c._count.id,
    }));
  }
}
