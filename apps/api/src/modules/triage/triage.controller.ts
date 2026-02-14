import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TriageService } from './triage.service';

@Controller('triage')
@UseGuards(AuthGuard('jwt'))
export class TriageController {
  private readonly logger = new Logger(TriageController.name);

  constructor(private readonly triageService: TriageService) {}

  /**
   * Classify a ticket by ID
   * POST /api/v1/triage/classify/:ticketId
   */
  @Post('classify/:ticketId')
  async classifyTicket(@Param('ticketId', ParseIntPipe) ticketId: number) {
    this.logger.log(`Classification requested for ticket #${ticketId}`);
    return this.triageService.classifyTicket(ticketId);
  }

  /**
   * Get cache status for all boards
   * GET /api/v1/triage/cache/status
   */
  @Get('cache/status')
  async getCacheStatus() {
    return this.triageService.getCacheStatus();
  }

  /**
   * Trigger manual cache refresh
   * POST /api/v1/triage/cache/refresh
   */
  @Post('cache/refresh')
  async refreshCache() {
    this.logger.log('Manual cache refresh triggered');
    const results = await this.triageService.refreshAllBoardCaches();
    return { message: 'Cache refreshed', boards: results };
  }

  /**
   * Get triage logs
   * GET /api/v1/triage/logs?page=1&limit=20
   */
  @Get('logs')
  async getTriageLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.triageService.getTriageLogs(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  /**
   * Reload ITIL prompt from database
   * POST /api/v1/triage/prompt/reload
   */
  @Post('prompt/reload')
  async reloadPrompt() {
    return this.triageService.reloadPrompt();
  }
}
