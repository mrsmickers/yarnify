import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  UsePipes,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TrainingRulesService } from './training-rules.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateTrainingRuleDto,
  CreateTrainingRuleSchema,
} from './dto/create-training-rule.dto';
import {
  UpdateTrainingRuleDto,
  UpdateTrainingRuleSchema,
} from './dto/update-training-rule.dto';

@ApiTags('Admin - Training Rules')
@ApiBearerAuth()
@Controller('admin/training-rules')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class TrainingRulesController {
  private readonly logger = new Logger(TrainingRulesController.name);

  constructor(private readonly trainingRulesService: TrainingRulesService) {}

  @Get()
  @ApiOperation({ summary: 'List all training rules' })
  @ApiResponse({ status: 200, description: 'Returns list of all training rules' })
  async findAll(
    @Query('category') category?: string,
    @Query('department') department?: string,
    @Query('isActive') isActive?: string,
  ) {
    this.logger.log('Admin requested training rules list');
    return this.trainingRulesService.findAll({
      category,
      department,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single training rule' })
  @ApiResponse({ status: 200, description: 'Returns the training rule' })
  @ApiResponse({ status: 404, description: 'Training rule not found' })
  async findOne(@Param('id') id: string) {
    this.logger.log(`Admin requested training rule: ${id}`);
    return this.trainingRulesService.findById(id);
  }

  @Post()
  @UsePipes(new ZodValidationPipe(CreateTrainingRuleSchema))
  @ApiOperation({ summary: 'Create a new training rule' })
  @ApiResponse({ status: 201, description: 'Training rule created successfully' })
  async create(@Body() dto: CreateTrainingRuleDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.email || null;
    this.logger.log(`Admin creating training rule: ${dto.title}`);
    return this.trainingRulesService.create(dto, userId);
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateTrainingRuleSchema))
  @ApiOperation({ summary: 'Update a training rule' })
  @ApiResponse({ status: 200, description: 'Training rule updated successfully' })
  @ApiResponse({ status: 404, description: 'Training rule not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingRuleDto,
  ) {
    this.logger.log(`Admin updating training rule: ${id}`);
    return this.trainingRulesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a training rule' })
  @ApiResponse({ status: 200, description: 'Training rule deleted successfully' })
  @ApiResponse({ status: 404, description: 'Training rule not found' })
  async delete(@Param('id') id: string) {
    this.logger.log(`Admin deleting training rule: ${id}`);
    return this.trainingRulesService.delete(id);
  }
}
