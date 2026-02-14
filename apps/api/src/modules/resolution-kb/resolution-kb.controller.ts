import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ResolutionKbService } from './resolution-kb.service';
import { JwtOrStagingGuard } from '../auth/guards/jwt-or-staging.guard';

@Controller('resolution-kb')
@UseGuards(JwtOrStagingGuard)
export class ResolutionKbController {
  private readonly logger = new Logger(ResolutionKbController.name);

  constructor(private readonly resolutionKbService: ResolutionKbService) {}

  /**
   * GET /api/v1/resolution-kb/stats
   * Get KB statistics
   */
  @Get('stats')
  async getStats() {
    return this.resolutionKbService.getStats();
  }

  /**
   * GET /api/v1/resolution-kb/search?q=...&limit=5&board=...&type=...
   * Search for similar past resolutions
   */
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('board') board?: string,
    @Query('type') type?: string,
    @Query('minSimilarity') minSimilarity?: string,
  ) {
    if (!query) {
      return { error: 'Query parameter "q" is required', results: [] };
    }

    const results = await this.resolutionKbService.searchSimilar(query, {
      limit: limit ? parseInt(limit, 10) : 5,
      board: board || undefined,
      type: type || undefined,
      minSimilarity: minSimilarity ? parseFloat(minSimilarity) : 0.5,
    });

    return { query, count: results.length, results };
  }

  /**
   * POST /api/v1/resolution-kb/sync?limit=100&since=2024-01-01
   * Trigger a sync of closed tickets into the KB
   */
  @Post('sync')
  async sync(
    @Query('limit') limit?: string,
    @Query('since') since?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    this.logger.log(
      `Manual sync triggered (limit: ${limit || 100}, since: ${since || 'last cursor'}, dryRun: ${dryRun || false})`,
    );

    const result = await this.resolutionKbService.syncClosedTickets({
      limit: limit ? parseInt(limit, 10) : 100,
      since: since ? new Date(since) : undefined,
      dryRun: dryRun === 'true',
    });

    return result;
  }

  /**
   * POST /api/v1/resolution-kb/refresh-names
   * Refresh the company/contact name cache used for anonymisation
   */
  @Post('refresh-names')
  async refreshNames() {
    return this.resolutionKbService.refreshNameCache();
  }
}
