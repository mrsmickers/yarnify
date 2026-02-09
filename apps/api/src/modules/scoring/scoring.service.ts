import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateScoringCategoryDto } from './dto/create-scoring-category.dto';
import { UpdateScoringCategoryDto } from './dto/update-scoring-category.dto';

export interface RuleEvaluationResult {
  ruleId: string;
  ruleTitle: string;
  ruleDescription: string;
  isCritical: boolean;
  ruleWeight: number;
  passed: boolean;
  score: number;
  reasoning: string | null;
  evidence: string | null;
}

export interface CategoryScoreBreakdown {
  name: string;
  label: string;
  weight: number;
  score: number; // 0-100 weighted score within category
  ruleCount: number;
  rules: RuleEvaluationResult[];
}

export interface CallScoreResult {
  overallScore: number; // 0-100
  categories: CategoryScoreBreakdown[];
  criticalFails: RuleEvaluationResult[];
  evaluationCount: number;
  hasCriticalFail: boolean;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ─── Scoring Categories CRUD ───────────────────────────────

  async findAllCategories() {
    return this.prisma.scoringCategory.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findCategoryById(id: string) {
    const category = await this.prisma.scoringCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException(`Scoring category ${id} not found`);
    }
    return category;
  }

  async createCategory(dto: CreateScoringCategoryDto) {
    return this.prisma.scoringCategory.create({
      data: {
        name: dto.name,
        label: dto.label,
        weight: dto.weight ?? 100,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateScoringCategoryDto) {
    const existing = await this.findCategoryById(id); // ensure exists
    const updated = await this.prisma.scoringCategory.update({
      where: { id },
      data: dto,
    });

    // Audit log: scoring category updated
    this.auditService.log({
      action: 'config.scoring.update',
      targetType: 'scoring',
      targetId: id,
      targetName: updated.label || updated.name,
      metadata: {
        previousWeight: existing.weight,
        newWeight: updated.weight,
        changes: dto,
      },
    }).catch(() => {}); // Fire-and-forget

    return updated;
  }

  async deleteCategory(id: string) {
    await this.findCategoryById(id); // ensure exists
    return this.prisma.scoringCategory.delete({
      where: { id },
    });
  }

  // ─── Score Calculation ─────────────────────────────────────

  /**
   * Calculate the overall weighted call score from training rule evaluations.
   * Returns null if no evaluations exist for this call analysis.
   */
  async calculateCallScore(callAnalysisId: string): Promise<CallScoreResult | null> {
    // Get evaluations with their training rules
    const evaluations = await this.prisma.trainingRuleEvaluation.findMany({
      where: { callAnalysisId },
      include: {
        trainingRule: true,
      },
    });

    if (evaluations.length === 0) {
      return null;
    }

    // Get active scoring categories
    const categories = await this.prisma.scoringCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const criticalFails: RuleEvaluationResult[] = [];
    const categoryBreakdowns: CategoryScoreBreakdown[] = [];

    for (const category of categories) {
      // Find evaluations for rules in this category
      const categoryEvals = evaluations.filter(
        (e) => e.trainingRule.category === category.name,
      );

      const rules: RuleEvaluationResult[] = categoryEvals.map((e) => {
        const result: RuleEvaluationResult = {
          ruleId: e.trainingRule.id,
          ruleTitle: e.trainingRule.title,
          ruleDescription: e.trainingRule.description,
          isCritical: e.trainingRule.isCritical,
          ruleWeight: e.trainingRule.weight,
          passed: e.passed,
          score: e.score,
          reasoning: e.reasoning,
          evidence: e.evidence,
        };

        // Track critical fails
        if (e.trainingRule.isCritical && !e.passed) {
          criticalFails.push(result);
        }

        return result;
      });

      // Calculate weighted category score (0-100)
      let categoryScore = 0;
      if (rules.length > 0) {
        const totalWeight = rules.reduce((sum, r) => sum + r.ruleWeight, 0);
        if (totalWeight > 0) {
          const weightedSum = rules.reduce(
            (sum, r) => sum + (r.score / 10) * 100 * (r.ruleWeight / totalWeight),
            0,
          );
          categoryScore = Math.round(weightedSum);
        }
      }

      categoryBreakdowns.push({
        name: category.name,
        label: category.label,
        weight: category.weight,
        score: categoryScore,
        ruleCount: rules.length,
        rules,
      });
    }

    // Calculate overall score as weighted average across categories
    const totalCategoryWeight = categoryBreakdowns.reduce(
      (sum, c) => sum + (c.ruleCount > 0 ? c.weight : 0),
      0,
    );

    let overallScore = 0;
    if (totalCategoryWeight > 0) {
      overallScore = Math.round(
        categoryBreakdowns.reduce(
          (sum, c) =>
            sum + (c.ruleCount > 0 ? (c.score * c.weight) / totalCategoryWeight : 0),
          0,
        ),
      );
    }

    // Cap at 0 if any critical fails
    const hasCriticalFail = criticalFails.length > 0;

    return {
      overallScore: hasCriticalFail ? Math.min(overallScore, 50) : overallScore,
      categories: categoryBreakdowns,
      criticalFails,
      evaluationCount: evaluations.length,
      hasCriticalFail,
    };
  }

  /**
   * Get a detailed score breakdown for a call.
   * Finds the call analysis by callId first.
   */
  async getCallScoreBreakdown(callId: string): Promise<CallScoreResult | null> {
    // Find the call and its analysis
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: { callAnalysisId: true },
    });

    if (!call?.callAnalysisId) {
      return null;
    }

    return this.calculateCallScore(call.callAnalysisId);
  }
}
