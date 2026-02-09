import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
  UsePipes,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtOrStagingGuard } from '../../common/guards/jwt-or-staging.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LLMConfigService } from './llm-config.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateLLMConfigDto,
  CreateLLMConfigSchema,
} from './dto/create-llm-config.dto';
import {
  UpdateLLMConfigDto,
  UpdateLLMConfigSchema,
} from './dto/update-llm-config.dto';

@ApiTags('Admin - LLM Configuration')
@ApiBearerAuth()
@Controller('admin/llm-configs')
@UseGuards(JwtOrStagingGuard, RolesGuard)
@Roles('admin')
export class LLMConfigController {
  private readonly logger = new Logger(LLMConfigController.name);

  constructor(private readonly llmConfigService: LLMConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all LLM configurations' })
  @ApiResponse({ status: 200, description: 'Returns list of all LLM configs' })
  async findAll() {
    this.logger.log('Admin requested LLM configurations list');
    return this.llmConfigService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single LLM configuration' })
  @ApiResponse({ status: 200, description: 'Returns the LLM configuration' })
  @ApiResponse({ status: 404, description: 'LLM config not found' })
  async findOne(@Param('id') id: string) {
    this.logger.log(`Admin requested LLM configuration: ${id}`);
    return this.llmConfigService.findOne(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateLLMConfigSchema))
  @ApiOperation({ summary: 'Create a new LLM configuration' })
  @ApiResponse({ status: 201, description: 'LLM config created successfully' })
  async create(@Body() dto: CreateLLMConfigDto, @Request() req: any) {
    const userId = req.user?.sub;
    this.logger.log(`Admin creating LLM configuration: ${dto.name}`);
    return this.llmConfigService.create(dto, userId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateLLMConfigSchema))
  @ApiOperation({ summary: 'Update an LLM configuration' })
  @ApiResponse({ status: 200, description: 'LLM config updated successfully' })
  @ApiResponse({ status: 404, description: 'LLM config not found' })
  async update(@Param('id') id: string, @Body() dto: UpdateLLMConfigDto) {
    this.logger.log(`Admin updating LLM configuration: ${id}`);
    return this.llmConfigService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an LLM configuration' })
  @ApiResponse({ status: 200, description: 'LLM config deleted successfully' })
  @ApiResponse({ status: 404, description: 'LLM config not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete active LLM config' })
  async delete(@Param('id') id: string) {
    this.logger.log(`Admin deleting LLM configuration: ${id}`);
    return this.llmConfigService.delete(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate an LLM configuration for its use case' })
  @ApiResponse({
    status: 200,
    description: 'LLM config activated successfully',
  })
  @ApiResponse({ status: 404, description: 'LLM config not found' })
  async activate(@Param('id') id: string) {
    this.logger.log(`Admin activating LLM configuration: ${id}`);
    return this.llmConfigService.activate(id);
  }
}

