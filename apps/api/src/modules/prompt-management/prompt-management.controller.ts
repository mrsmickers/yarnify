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
import { PromptManagementService } from './prompt-management.service';
import { PromptVariableResolverService } from './prompt-variable-resolver.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreatePromptDto,
  CreatePromptSchema,
} from './dto/create-prompt.dto';
import {
  UpdatePromptDto,
  UpdatePromptSchema,
} from './dto/update-prompt.dto';

@ApiTags('Admin - Prompt Management')
@ApiBearerAuth()
@Controller('admin/prompts')
@UseGuards(JwtOrStagingGuard, RolesGuard)
@Roles('admin')
export class PromptManagementController {
  private readonly logger = new Logger(PromptManagementController.name);

  constructor(
    private readonly promptManagementService: PromptManagementService,
    private readonly variableResolver: PromptVariableResolverService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all prompt templates' })
  @ApiResponse({ status: 200, description: 'Returns list of all prompts' })
  async findAll() {
    this.logger.log('Admin requested prompt templates list');
    return this.promptManagementService.findAll();
  }

  @Get('variables/:useCase')
  @ApiOperation({ summary: 'Get available template variables for a use case' })
  @ApiResponse({ status: 200, description: 'Returns list of available variables' })
  async getVariables(@Param('useCase') useCase: string) {
    return this.variableResolver.getAvailableVariables(useCase);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single prompt template' })
  @ApiResponse({ status: 200, description: 'Returns the prompt template' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async findOne(@Param('id') id: string) {
    this.logger.log(`Admin requested prompt template: ${id}`);
    return this.promptManagementService.findOne(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreatePromptSchema))
  @ApiOperation({ summary: 'Create a new prompt template' })
  @ApiResponse({ status: 201, description: 'Prompt created successfully' })
  async create(@Body() dto: CreatePromptDto, @Request() req: any) {
    const userId = req.user?.sub;
    this.logger.log(`Admin creating prompt template: ${dto.name}`);
    return this.promptManagementService.create(dto, userId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdatePromptSchema))
  @ApiOperation({ summary: 'Update a prompt template' })
  @ApiResponse({ status: 200, description: 'Prompt updated successfully' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async update(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    this.logger.log(`Admin updating prompt template: ${id}`);
    return this.promptManagementService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a prompt template' })
  @ApiResponse({ status: 200, description: 'Prompt deleted successfully' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete active prompt' })
  async delete(@Param('id') id: string) {
    this.logger.log(`Admin deleting prompt template: ${id}`);
    return this.promptManagementService.delete(id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a prompt template for its use case' })
  @ApiResponse({ status: 200, description: 'Prompt activated successfully' })
  @ApiResponse({ status: 404, description: 'Prompt not found' })
  async activate(@Param('id') id: string) {
    this.logger.log(`Admin activating prompt template: ${id}`);
    return this.promptManagementService.activate(id);
  }
}

