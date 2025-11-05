import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLLMConfigDto } from './dto/create-llm-config.dto';
import { UpdateLLMConfigDto } from './dto/update-llm-config.dto';

@Injectable()
export class LLMConfigService {
  private readonly logger = new Logger(LLMConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.lLMConfiguration.findMany({
      orderBy: [{ useCase: 'asc' }, { isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const config = await this.prisma.lLMConfiguration.findUnique({
      where: { id },
    });

    if (!config) {
      throw new NotFoundException(`LLM configuration with ID ${id} not found`);
    }

    return config;
  }

  async findActiveByUseCase(useCase: string) {
    const config = await this.prisma.lLMConfiguration.findFirst({
      where: {
        useCase,
        isActive: true,
      },
    });

    if (!config) {
      this.logger.warn(`No active LLM config found for use case: ${useCase}`);
      return null;
    }

    return config;
  }

  async create(dto: CreateLLMConfigDto, createdBy?: string) {
    return this.prisma.lLMConfiguration.create({
      data: {
        name: dto.name,
        useCase: dto.useCase,
        modelName: dto.modelName,
        provider: dto.provider,
        settings: dto.settings,
        createdBy,
      },
    });
  }

  async update(id: string, dto: UpdateLLMConfigDto) {
    const existing = await this.findOne(id);

    return this.prisma.lLMConfiguration.update({
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
        'Cannot delete an active LLM configuration. Please activate another configuration first.',
      );
    }

    await this.prisma.lLMConfiguration.delete({
      where: { id },
    });

    return { success: true };
  }

  async activate(id: string) {
    const config = await this.findOne(id);

    // Use a transaction to ensure only one config is active per use case
    await this.prisma.$transaction([
      // Deactivate all configs for this use case
      this.prisma.lLMConfiguration.updateMany({
        where: {
          useCase: config.useCase,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      }),
      // Activate the specified config
      this.prisma.lLMConfiguration.update({
        where: { id },
        data: {
          isActive: true,
        },
      }),
    ]);

    return this.findOne(id);
  }
}

