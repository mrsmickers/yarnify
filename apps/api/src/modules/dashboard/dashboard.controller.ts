import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtOrStagingGuard } from '../../common/guards/jwt-or-staging.guard';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Request } from 'express';
import { JwtPayload } from '../../common/interfaces/cls-store.interface';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtOrStagingGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Build user context from JWT for role-based data scoping
   */
  private async getUserContext(req: Request) {
    const payload = req.user as JwtPayload;
    if (payload?.oid) {
      const storedUser = await this.dashboardService.getUserContext(
        payload.oid,
      );
      if (storedUser) {
        return {
          role: storedUser.role,
          userId: payload.oid,
          department: storedUser.department,
        };
      }
    }
    return undefined;
  }

  @Get('overview')
  @ApiOperation({ summary: 'Get dashboard overview stats' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getOverview(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userContext = await this.getUserContext(req);
    return this.dashboardService.getOverviewStats(
      { startDate, endDate },
      userContext,
    );
  }

  @Get('sentiment')
  @ApiOperation({ summary: 'Get sentiment breakdown' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getSentiment(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userContext = await this.getUserContext(req);
    return this.dashboardService.getSentimentBreakdown(
      { startDate, endDate },
      userContext,
    );
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get call volume trend' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day', 'week'] })
  async getVolume(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('granularity') granularity?: 'day' | 'week',
  ) {
    const userContext = await this.getUserContext(req);
    return this.dashboardService.getCallVolumeTrend(
      { startDate, endDate },
      granularity || 'day',
      userContext,
    );
  }

  @Get('agents')
  @ApiOperation({ summary: 'Get agent performance metrics' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async getAgents(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const userContext = await this.getUserContext(req);
    return this.dashboardService.getAgentPerformance(
      { startDate, endDate },
      userContext,
    );
  }

  @Get('companies')
  @ApiOperation({ summary: 'Get top companies by call volume' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getCompanies(
    @Req() req: Request,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: string,
  ) {
    const userContext = await this.getUserContext(req);
    return this.dashboardService.getTopCompanies(
      { startDate, endDate },
      limit ? parseInt(limit, 10) : 10,
      userContext,
    );
  }
}
