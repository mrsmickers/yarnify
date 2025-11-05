import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';

@Injectable()
export class PromptManagementService {
  private readonly logger = new Logger(PromptManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.promptTemplate.findMany({
      orderBy: [{ useCase: 'asc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const prompt = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt template with ID ${id} not found`);
    }

    return prompt;
  }

  async findActiveByUseCase(useCase: string) {
    const prompt = await this.prisma.promptTemplate.findFirst({
      where: {
        useCase,
        isActive: true,
      },
    });

    if (!prompt) {
      this.logger.warn(`No active prompt found for use case: ${useCase}`);
      return null;
    }

    return prompt;
  }

  async create(dto: CreatePromptDto, createdBy?: string) {
    return this.prisma.promptTemplate.create({
      data: {
        name: dto.name,
        useCase: dto.useCase,
        content: dto.content,
        version: dto.version,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdatePromptDto) {
    const existing = await this.findOne(id);

    return this.prisma.promptTemplate.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async delete(id: string) {
    const existing = await this.findOne(id);

    if (existing.isActive) {
      throw new BadRequestException(
        'Cannot delete an active prompt. Please activate another prompt first.',
      );
    }

    await this.prisma.promptTemplate.delete({
      where: { id },
    });

    return { success: true };
  }

  async activate(id: string) {
    const prompt = await this.findOne(id);

    // Use a transaction to ensure only one prompt is active per use case
    await this.prisma.$transaction([
      // Deactivate all prompts for this use case
      this.prisma.promptTemplate.updateMany({
        where: {
          useCase: prompt.useCase,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      }),
      // Activate the specified prompt
      this.prisma.promptTemplate.update({
        where: { id },
        data: {
          isActive: true,
        },
      }),
    ]);

    return this.findOne(id);
  }
}

