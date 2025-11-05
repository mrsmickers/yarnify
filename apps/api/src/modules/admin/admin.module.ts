import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AdminController } from './admin.controller';
import { SystemController } from './system.controller';
import { AdminAgentsController } from './admin-agents.controller';
import { AdminService } from './admin.service';
import { AdminAgentsService } from './admin-agents.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ConnectwiseManageModule } from '../connectwise-manage/connectwise-manage.module';
import { OpenAIModule } from '../openai/openai.module';
import { VoipModule } from '../voip/voip.module';
import { CallAnalysisModule } from '../call-analysis/call-analysis.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConnectwiseManageModule,
    OpenAIModule,
    VoipModule,
    CallAnalysisModule,
    HttpModule,
  ],
  controllers: [AdminController, SystemController, AdminAgentsController],
  providers: [AdminService, AdminAgentsService],
  exports: [AdminService, AdminAgentsService],
})
export class AdminModule {}

