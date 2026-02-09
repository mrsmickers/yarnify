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
import { ScoringService } from './scoring.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateScoringCategoryDto,
  CreateScoringCategorySchema,
} from './dto/create-scoring-category.dto';
import {
  UpdateScoringCategoryDto,
  UpdateScoringCategorySchema,
} from './dto/update-scoring-category.dto';

@ApiTags('Scoring')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtOrStagingGuard, RolesGuard)
export class ScoringController {
  private readonly logger = new Logger(ScoringController.name);

  constructor(private readonly scoringService: ScoringService) {}

  // ─── Call Score Endpoints ──────────────────────────────────

  @Get('calls/:callId/score')
  @ApiOperation({ summary: 'Get score breakdown for a call' })
  @ApiResponse({ status: 200, description: 'Returns call score breakdown' })
  async getCallScore(@Param('callId') callId: string) {
    this.logger.log(`Fetching score for call: ${callId}`);
    const score = await this.scoringService.getCallScoreBreakdown(callId);
    return score ?? { overallScore: null, categories: [], criticalFails: [], evaluationCount: 0, hasCriticalFail: false };
  }

  // ─── Admin Scoring Category Endpoints ──────────────────────

  @Get('admin/scoring/categories')
  @Roles('admin')
  @ApiOperation({ summary: 'List all scoring categories' })
  @ApiResponse({ status: 200, description: 'Returns list of scoring categories' })
  async listCategories() {
    this.logger.log('Admin requested scoring categories list');
    return this.scoringService.findAllCategories();
  }

  @Post('admin/scoring/categories')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(CreateScoringCategorySchema))
  @ApiOperation({ summary: 'Create a new scoring category' })
  @ApiResponse({ status: 201, description: 'Scoring category created' })
  async createCategory(@Body() dto: CreateScoringCategoryDto) {
    this.logger.log(`Admin creating scoring category: ${dto.name}`);
    return this.scoringService.createCategory(dto);
  }

  @Patch('admin/scoring/categories/:id')
  @Roles('admin')
  @UsePipes(new ZodValidationPipe(UpdateScoringCategorySchema))
  @ApiOperation({ summary: 'Update a scoring category' })
  @ApiResponse({ status: 200, description: 'Scoring category updated' })
  @ApiResponse({ status: 404, description: 'Scoring category not found' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateScoringCategoryDto,
  ) {
    this.logger.log(`Admin updating scoring category: ${id}`);
    return this.scoringService.updateCategory(id, dto);
  }

  @Delete('admin/scoring/categories/:id')
  @Roles('admin')
  @ApiOperation({ summary: 'Delete a scoring category' })
  @ApiResponse({ status: 200, description: 'Scoring category deleted' })
  @ApiResponse({ status: 404, description: 'Scoring category not found' })
  async deleteCategory(@Param('id') id: string) {
    this.logger.log(`Admin deleting scoring category: ${id}`);
    return this.scoringService.deleteCategory(id);
  }
}
