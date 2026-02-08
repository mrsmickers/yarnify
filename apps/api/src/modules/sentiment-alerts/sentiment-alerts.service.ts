import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSentimentAlertConfigDto } from './dto/create-sentiment-alert-config.dto';
import { UpdateSentimentAlertConfigDto } from './dto/update-sentiment-alert-config.dto';

// Frustration levels ordered from lowest to highest for comparison
const FRUSTRATION_LEVELS = ['Low', 'Medium', 'High'];

@Injectable()
export class SentimentAlertsService {
  private readonly logger = new Logger(SentimentAlertsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Alert Config CRUD ─────────────────────────────────────────────────

  async getAlertConfigs() {
    return this.prisma.sentimentAlertConfig.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAlertConfigById(id: string) {
    const config = await this.prisma.sentimentAlertConfig.findUnique({
      where: { id },
    });
    if (!config) {
      throw new NotFoundException(`Sentiment alert config with ID ${id} not found`);
    }
    return config;
  }

  async createConfig(dto: CreateSentimentAlertConfigDto) {
    return this.prisma.sentimentAlertConfig.create({
      data: {
        name: dto.name,
        isActive: dto.isActive ?? true,
        sentimentValues: dto.sentimentValues ?? [],
        frustrationMin: dto.frustrationMin ?? null,
        flagForReview: dto.flagForReview ?? true,
        notifyEmails: dto.notifyEmails ?? [],
      },
    });
  }

  async updateConfig(id: string, dto: UpdateSentimentAlertConfigDto) {
    await this.getAlertConfigById(id);
    return this.prisma.sentimentAlertConfig.update({
      where: { id },
      data: { ...dto },
    });
  }

  async deleteConfig(id: string) {
    await this.getAlertConfigById(id);
    await this.prisma.sentimentAlertConfig.delete({ where: { id } });
    return { success: true };
  }

  // ── Alert Evaluation ──────────────────────────────────────────────────

  /**
   * Evaluate a call's analysis data against all active sentiment alert configs.
   * Creates SentimentAlert records for any matches.
   */
  async evaluateCall(
    callId: string,
    callAnalysisId: string,
    analysisData: Record<string, unknown>,
  ): Promise<void> {
    const configs = await this.prisma.sentimentAlertConfig.findMany({
      where: { isActive: true },
    });

    if (configs.length === 0) {
      return;
    }

    const sentiment = (analysisData.sentiment as string) || null;
    const frustration = (analysisData.frustration_level as string) || null;

    const alertsToCreate: Array<{
      callId: string;
      callAnalysisId: string;
      configId: string;
      alertType: string;
      severity: string;
      sentiment: string | null;
      frustration: string | null;
    }> = [];

    for (const config of configs) {
      let matched = false;
      let alertType = 'negative_sentiment';
      let severity = 'warning';

      // Check sentiment match
      const sentimentMatch =
        config.sentimentValues.length > 0 &&
        sentiment &&
        config.sentimentValues.includes(sentiment);

      // Check frustration match
      const frustrationMatch = this.frustrationMeetsMinimum(
        frustration,
        config.frustrationMin,
      );

      // Either condition can trigger the alert
      if (sentimentMatch) {
        matched = true;
        alertType = 'negative_sentiment';
        // "Very Negative" or "Negative" → critical if Very Negative
        severity = sentiment === 'Very Negative' ? 'critical' : 'warning';
      }

      if (frustrationMatch) {
        matched = true;
        alertType = sentimentMatch ? 'negative_sentiment' : 'high_frustration';
        // High frustration is always at least warning, bump to critical if sentiment is also bad
        if (frustration === 'High') {
          severity = 'critical';
        }
      }

      if (matched) {
        alertsToCreate.push({
          callId,
          callAnalysisId,
          configId: config.id,
          alertType,
          severity,
          sentiment,
          frustration,
        });
      }
    }

    if (alertsToCreate.length > 0) {
      await this.prisma.sentimentAlert.createMany({
        data: alertsToCreate,
      });
      this.logger.log(
        `Created ${alertsToCreate.length} sentiment alert(s) for call ${callId}`,
      );
    }
  }

  /**
   * Check if a frustration level meets the minimum threshold.
   */
  private frustrationMeetsMinimum(
    actual: string | null,
    minimum: string | null,
  ): boolean {
    if (!minimum || !actual) return false;
    const actualIdx = FRUSTRATION_LEVELS.indexOf(actual);
    const minIdx = FRUSTRATION_LEVELS.indexOf(minimum);
    if (actualIdx === -1 || minIdx === -1) return false;
    return actualIdx >= minIdx;
  }

  // ── Alert Queries ─────────────────────────────────────────────────────

  async getAlerts(query: {
    status?: string; // 'pending' | 'reviewed' | 'dismissed' | 'all'
    severity?: string;
    alertType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    // Status filter
    if (query.status === 'pending') {
      where.reviewedAt = null;
      where.dismissedAt = null;
    } else if (query.status === 'reviewed') {
      where.reviewedAt = { not: null };
    } else if (query.status === 'dismissed') {
      where.dismissedAt = { not: null };
    }

    if (query.severity) {
      where.severity = query.severity;
    }
    if (query.alertType) {
      where.alertType = query.alertType;
    }

    const [alerts, total] = await Promise.all([
      this.prisma.sentimentAlert.findMany({
        where,
        include: {
          call: {
            include: {
              company: true,
              Agents: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sentimentAlert.count({ where }),
    ]);

    return {
      data: alerts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAlertById(id: string) {
    const alert = await this.prisma.sentimentAlert.findUnique({
      where: { id },
      include: {
        call: {
          include: {
            company: true,
            Agents: true,
          },
        },
      },
    });
    if (!alert) {
      throw new NotFoundException(`Sentiment alert with ID ${id} not found`);
    }
    return alert;
  }

  async reviewAlert(id: string, reviewedBy: string, reviewNotes?: string) {
    await this.getAlertById(id);
    return this.prisma.sentimentAlert.update({
      where: { id },
      data: {
        reviewedAt: new Date(),
        reviewedBy,
        reviewNotes: reviewNotes || null,
      },
    });
  }

  async dismissAlert(id: string, dismissedBy: string) {
    await this.getAlertById(id);
    return this.prisma.sentimentAlert.update({
      where: { id },
      data: {
        dismissedAt: new Date(),
        // Also set reviewedBy so we know who dismissed it
        reviewedBy: dismissedBy,
      },
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  async getAlertStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalPending, reviewedToday, criticalPending] = await Promise.all([
      this.prisma.sentimentAlert.count({
        where: { reviewedAt: null, dismissedAt: null },
      }),
      this.prisma.sentimentAlert.count({
        where: { reviewedAt: { gte: today } },
      }),
      this.prisma.sentimentAlert.count({
        where: { severity: 'critical', reviewedAt: null, dismissedAt: null },
      }),
    ]);

    return { totalPending, reviewedToday, criticalPending };
  }

  /**
   * Get count of pending alerts (for nav badge).
   */
  async getPendingCount(): Promise<number> {
    return this.prisma.sentimentAlert.count({
      where: { reviewedAt: null, dismissedAt: null },
    });
  }

  /**
   * Get sentiment alerts for a specific call.
   */
  async getAlertsForCall(callId: string) {
    return this.prisma.sentimentAlert.findMany({
      where: { callId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
