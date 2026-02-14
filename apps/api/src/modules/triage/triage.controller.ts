import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TriageService } from './triage.service';

/**
 * Unauthenticated webhook endpoint — CW callbacks hit this directly.
 * Separate from the authenticated admin endpoints below.
 */
@Controller('triage')
export class TriageWebhookController {
  private readonly logger = new Logger(TriageWebhookController.name);

  constructor(private readonly triageService: TriageService) {}

  /**
   * CW callback receiver
   * POST /api/v1/triage/webhook
   *
   * CW sends: { ID, Type, Action, MemberID, CompanyID, Entity }
   * No auth — CW can't send bearer tokens.
   */
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(@Body() payload: any) {
    this.logger.log(
      `CW callback received: Type=${payload?.Type} Action=${payload?.Action} ID=${payload?.ID}`,
    );
    const result = await this.triageService.handleCallback(payload);
    // Always return 200 to CW (even on errors) to prevent retry storms
    return { ok: true, ...result };
  }
}

/**
 * Authenticated admin/API endpoints for triage management.
 */
@Controller('triage')
@UseGuards(AuthGuard('jwt'))
export class TriageAdminController {
  private readonly logger = new Logger(TriageAdminController.name);

  constructor(private readonly triageService: TriageService) {}

  /**
   * Classify a ticket by ID (manual trigger)
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

  /**
   * Register/verify the CW callback
   * POST /api/v1/triage/callback/register
   */
  @Post('callback/register')
  async registerCallback() {
    return this.triageService.ensureCallback();
  }

  /**
   * List all CW callbacks
   * GET /api/v1/triage/callback/list
   */
  @Get('callback/list')
  async listCallbacks() {
    return this.triageService.listCallbacks();
  }
}
