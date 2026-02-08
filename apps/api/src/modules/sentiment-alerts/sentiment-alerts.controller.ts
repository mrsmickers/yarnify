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
import { SentimentAlertsService } from './sentiment-alerts.service';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateSentimentAlertConfigDto,
  CreateSentimentAlertConfigSchema,
} from './dto/create-sentiment-alert-config.dto';
import {
  UpdateSentimentAlertConfigDto,
  UpdateSentimentAlertConfigSchema,
} from './dto/update-sentiment-alert-config.dto';
import {
  ReviewAlertSchema,
  ReviewAlertDto,
  DismissAlertSchema,
  DismissAlertDto,
} from './dto/review-alert.dto';

@ApiTags('Admin - Sentiment Alerts')
@ApiBearerAuth()
@Controller('admin/sentiment-alerts')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class SentimentAlertsController {
  private readonly logger = new Logger(SentimentAlertsController.name);

  constructor(private readonly sentimentAlertsService: SentimentAlertsService) {}

  // ── Alerts ────────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List sentiment alerts (paginated, filterable)' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of sentiment alerts' })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('alertType') alertType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log('Admin requested sentiment alerts list');
    return this.sentimentAlertsService.getAlerts({
      status,
      severity,
      alertType,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get sentiment alert statistics' })
  @ApiResponse({ status: 200, description: 'Returns alert stats' })
  async getStats() {
    return this.sentimentAlertsService.getAlertStats();
  }

  @Get('pending-count')
  @ApiOperation({ summary: 'Get count of pending alerts (for nav badge)' })
  @ApiResponse({ status: 200, description: 'Returns pending alert count' })
  async getPendingCount() {
    const count = await this.sentimentAlertsService.getPendingCount();
    return { count };
  }

  // ── Alert Config CRUD ─────────────────────────────────────────────────

  @Get('configs')
  @ApiOperation({ summary: 'List all sentiment alert configurations' })
  @ApiResponse({ status: 200, description: 'Returns list of alert configs' })
  async getConfigs() {
    this.logger.log('Admin requested sentiment alert configs');
    return this.sentimentAlertsService.getAlertConfigs();
  }

  @Post('configs')
  @UsePipes(new ZodValidationPipe(CreateSentimentAlertConfigSchema))
  @ApiOperation({ summary: 'Create a new sentiment alert configuration' })
  @ApiResponse({ status: 201, description: 'Alert config created successfully' })
  async createConfig(@Body() dto: CreateSentimentAlertConfigDto) {
    this.logger.log(`Admin creating sentiment alert config: ${dto.name}`);
    return this.sentimentAlertsService.createConfig(dto);
  }

  @Patch('configs/:id')
  @UsePipes(new ZodValidationPipe(UpdateSentimentAlertConfigSchema))
  @ApiOperation({ summary: 'Update a sentiment alert configuration' })
  @ApiResponse({ status: 200, description: 'Alert config updated successfully' })
  @ApiResponse({ status: 404, description: 'Alert config not found' })
  async updateConfig(
    @Param('id') id: string,
    @Body() dto: UpdateSentimentAlertConfigDto,
  ) {
    this.logger.log(`Admin updating sentiment alert config: ${id}`);
    return this.sentimentAlertsService.updateConfig(id, dto);
  }

  @Delete('configs/:id')
  @ApiOperation({ summary: 'Delete a sentiment alert configuration' })
  @ApiResponse({ status: 200, description: 'Alert config deleted successfully' })
  @ApiResponse({ status: 404, description: 'Alert config not found' })
  async deleteConfig(@Param('id') id: string) {
    this.logger.log(`Admin deleting sentiment alert config: ${id}`);
    return this.sentimentAlertsService.deleteConfig(id);
  }

  // ── Alert Actions ─────────────────────────────────────────────────────

  @Get('call/:callId')
  @ApiOperation({ summary: 'Get sentiment alerts for a specific call' })
  @ApiResponse({ status: 200, description: 'Returns alerts for the call' })
  async getAlertsForCall(@Param('callId') callId: string) {
    return this.sentimentAlertsService.getAlertsForCall(callId);
  }

  @Patch(':id/review')
  @ApiOperation({ summary: 'Mark a sentiment alert as reviewed' })
  @ApiResponse({ status: 200, description: 'Alert reviewed successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async reviewAlert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewAlertSchema)) dto: ReviewAlertDto,
  ) {
    this.logger.log(`Admin reviewing sentiment alert: ${id}`);
    return this.sentimentAlertsService.reviewAlert(id, dto.reviewedBy, dto.reviewNotes);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a sentiment alert' })
  @ApiResponse({ status: 200, description: 'Alert dismissed successfully' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async dismissAlert(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DismissAlertSchema)) dto: DismissAlertDto,
  ) {
    this.logger.log(`Admin dismissing sentiment alert: ${id}`);
    return this.sentimentAlertsService.dismissAlert(id, dto.dismissedBy);
  }
}
