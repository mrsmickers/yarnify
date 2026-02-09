import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateTrainingRuleDto } from './dto/create-training-rule.dto';
import { UpdateTrainingRuleDto } from './dto/update-training-rule.dto';

@Injectable()
export class TrainingRulesService {
  private readonly logger = new Logger(TrainingRulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(filters?: {
    category?: string;
    department?: string;
    isActive?: boolean;
  }) {
    const where: Record<string, unknown> = {};

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.department !== undefined) {
      where.department = filters.department;
    }
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.trainingRule.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findById(id: string) {
    const rule = await this.prisma.trainingRule.findUnique({
      where: { id },
    });

    if (!rule) {
      throw new NotFoundException(`Training rule with ID ${id} not found`);
    }

    return rule;
  }

  async create(dto: CreateTrainingRuleDto, createdBy?: string) {
    const rule = await this.prisma.trainingRule.create({
      data: {
        title: dto.title,
        description: dto.description,
        category: dto.category ?? 'general',
        department: dto.department ?? null,
        isActive: dto.isActive ?? true,
        isCritical: dto.isCritical ?? false,
        sortOrder: dto.sortOrder ?? 0,
        createdBy,
      },
    });

    // Audit log: training rule created
    this.auditService.log({
      action: 'config.training_rule.create',
      targetType: 'training_rule',
      targetId: rule.id,
      targetName: rule.title,
      metadata: {
        category: rule.category,
        department: rule.department,
        isCritical: rule.isCritical,
      },
    }).catch(() => {}); // Fire-and-forget

    return rule;
  }

  async update(id: string, dto: UpdateTrainingRuleDto) {
    // Verify exists
    const existing = await this.findById(id);

    const updated = await this.prisma.trainingRule.update({
      where: { id },
      data: {
        ...dto,
      },
    });

    // Audit log: training rule updated
    this.auditService.log({
      action: 'config.training_rule.update',
      targetType: 'training_rule',
      targetId: id,
      targetName: updated.title,
      metadata: {
        previousTitle: existing.title,
        changes: dto,
      },
    }).catch(() => {}); // Fire-and-forget

    return updated;
  }

  async delete(id: string) {
    // Verify exists
    const existing = await this.findById(id);

    await this.prisma.trainingRule.delete({
      where: { id },
    });

    // Audit log: training rule deleted
    this.auditService.log({
      action: 'config.training_rule.delete',
      targetType: 'training_rule',
      targetId: id,
      targetName: existing.title,
      metadata: {
        category: existing.category,
        department: existing.department,
        wasCritical: existing.isCritical,
      },
    }).catch(() => {}); // Fire-and-forget

    return { success: true };
  }

  /**
   * Get all active training rules, optionally filtered by department.
   * Rules with no department are always included (they apply globally).
   */
  async getActiveRules(department?: string) {
    const where: Record<string, unknown> = {
      isActive: true,
    };

    if (department) {
      // Include rules for the specific department AND global rules (no department)
      where.OR = [
        { department },
        { department: null },
      ];
    }

    return this.prisma.trainingRule.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  /**
   * Returns a formatted string of all active training rules
   * suitable for injecting into an LLM prompt.
   * Returns null if no active rules exist.
   */
  async getForPromptInjection(department?: string): Promise<string | null> {
    const rules = await this.getActiveRules(department);

    if (!rules || rules.length === 0) {
      this.logger.log('No active training rules found for prompt injection');
      return null;
    }

    const lines = [
      'Training Rules:',
      'The following training rules should be evaluated against this call. For each rule, assess whether the agent followed or violated it.',
      '',
    ];

    rules.forEach((rule, index) => {
      const criticalTag = rule.isCritical ? ' [CRITICAL]' : '';
      lines.push(
        `${index + 1}. ${rule.title}${criticalTag}: ${rule.description}`,
      );
    });

    return lines.join('\n');
  }
}
