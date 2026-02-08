import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCompanyInfoDto } from './dto/upsert-company-info.dto';

@Injectable()
export class CompanyInfoService {
  private readonly logger = new Logger(CompanyInfoService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the singleton company info row.
   * Returns null if no company info has been configured yet.
   */
  async get() {
    // Singleton pattern: always return the first (and only) row
    return this.prisma.companyInfo.findFirst();
  }

  /**
   * Upsert the singleton company info.
   * If a row exists, update it. Otherwise create it.
   */
  async upsert(dto: UpsertCompanyInfoDto, updatedBy?: string) {
    const existing = await this.prisma.companyInfo.findFirst();

    if (existing) {
      return this.prisma.companyInfo.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          description: dto.description,
          industry: dto.industry ?? null,
          location: dto.location ?? null,
          website: dto.website ?? null,
          additionalContext: dto.additionalContext ?? null,
          updatedBy,
        },
      });
    }

    return this.prisma.companyInfo.create({
      data: {
        name: dto.name,
        description: dto.description,
        industry: dto.industry ?? null,
        location: dto.location ?? null,
        website: dto.website ?? null,
        additionalContext: dto.additionalContext ?? null,
        updatedBy,
      },
    });
  }

  /**
   * Returns a formatted string suitable for injecting into LLM prompts.
   * Returns null if no company info is configured.
   */
  async getForPromptInjection(): Promise<string | null> {
    const info = await this.get();
    if (!info) {
      this.logger.warn('No company info configured — prompts will use defaults');
      return null;
    }

    const lines = [
      'COMPANY CONTEXT:',
      `Name: ${info.name}`,
    ];

    if (info.industry) {
      lines.push(`Industry: ${info.industry}`);
    }
    if (info.location) {
      lines.push(`Location: ${info.location}`);
    }
    if (info.description) {
      lines.push(`Description: ${info.description}`);
    }
    if (info.additionalContext) {
      lines.push(`Additional Context: ${info.additionalContext}`);
    }

    return lines.join('\n');
  }
}
