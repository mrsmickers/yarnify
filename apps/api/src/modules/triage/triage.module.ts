import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TriageService } from './triage.service';
import { TriageController } from './triage.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NvidiaModule } from '../nvidia/nvidia.module';
import { ConnectwiseManageModule } from '../connectwise-manage/connectwise-manage.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NvidiaModule,
    ConnectwiseManageModule,
  ],
  controllers: [TriageController],
  providers: [TriageService],
  exports: [TriageService],
})
export class TriageModule {}
