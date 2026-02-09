import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { AgentAccessModule } from '../agent-access/agent-access.module';

@Module({
  imports: [PrismaModule, AgentAccessModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
