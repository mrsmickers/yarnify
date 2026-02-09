import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('admin/audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin')
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit logs with filters (admin only)' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'ISO date string' })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String, description: 'Filter by action (partial match)' })
  @ApiQuery({ name: 'targetType', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (1-indexed)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default 50)' })
  @ApiResponse({
    status: 200,
    description: 'Returns paginated audit logs',
  })
  async getLogs(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('actorId') actorId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log('Admin requested audit logs');

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;
    const offset = (pageNum - 1) * limitNum;

    const { logs, total } = await this.auditService.getLogs({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      actorId,
      action,
      targetType,
      limit: limitNum,
      offset,
    });

    return {
      data: logs,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get audit action statistics for dashboard (admin only)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to look back (default 7)' })
  @ApiResponse({
    status: 200,
    description: 'Returns counts by action type',
  })
  async getStats(@Query('days') days?: string) {
    this.logger.log('Admin requested audit stats');

    const daysNum = days ? parseInt(days, 10) : 7;
    const since = new Date();
    since.setDate(since.getDate() - daysNum);

    const stats = await this.auditService.getStats(since);

    return {
      period: `${daysNum} days`,
      since: since.toISOString(),
      stats,
    };
  }

  @Get('target/:targetType/:targetId')
  @ApiOperation({ summary: 'Get audit logs for a specific target (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns audit logs for the specified target',
  })
  async getLogsByTarget(
    @Param('targetType') targetType: string,
    @Param('targetId') targetId: string,
  ) {
    this.logger.log(`Admin requested audit logs for ${targetType}:${targetId}`);

    const logs = await this.auditService.getLogsByTarget(targetType, targetId);

    return { data: logs };
  }
}
