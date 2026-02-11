import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  HttpCode,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MarketingSyncService } from './marketing-sync.service';
import { MarketingSyncProducer } from './marketing-sync.producer';
import { UpdateSyncDto, GetSyncRunsQueryDto } from './dto/marketing-sync.dto';

@UseGuards(AuthGuard('jwt'))
@ApiTags('Marketing')
@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly syncService: MarketingSyncService,
    private readonly syncProducer: MarketingSyncProducer,
  ) {}

  @Get('syncs')
  @ApiOperation({ summary: 'List all sync automations' })
  async listSyncs() {
    return this.syncService.listSyncs();
  }

  @Get('syncs/:id')
  @ApiOperation({ summary: 'Get sync detail with last 10 runs' })
  async getSync(@Param('id') id: string) {
    return this.syncService.getSyncById(id);
  }

  @Post('syncs/:id/trigger')
  @HttpCode(202)
  @ApiOperation({ summary: 'Trigger sync now (manual)' })
  async triggerSync(@Param('id') id: string) {
    // Verify sync exists
    await this.syncService.getSyncById(id);
    await this.syncProducer.triggerSync(id);
    return { message: 'Sync job queued' };
  }

  @Patch('syncs/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Update sync schedule or enable/disable' })
  async updateSync(@Param('id') id: string, @Body() dto: UpdateSyncDto) {
    const updated = await this.syncService.updateSync(id, dto);
    // Re-schedule all repeatable jobs so changes take effect
    await this.syncProducer.scheduleAllSyncs();
    return updated;
  }

  @Get('syncs/:id/runs')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  @ApiOperation({ summary: 'Get run history (paginated)' })
  async getSyncRuns(
    @Param('id') id: string,
    @Query() query: GetSyncRunsQueryDto,
  ) {
    return this.syncService.getSyncRuns(id, query);
  }

  @Get('syncs/:id/runs/:runId')
  @ApiOperation({ summary: 'Get single run detail' })
  async getSyncRun(
    @Param('id') id: string,
    @Param('runId') runId: string,
  ) {
    return this.syncService.getSyncRunById(id, runId);
  }
}
