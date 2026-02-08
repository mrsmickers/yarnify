import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SentimentAlertsController } from './sentiment-alerts.controller';
import { SentimentAlertsService } from './sentiment-alerts.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SentimentAlertsController],
  providers: [SentimentAlertsService],
  exports: [SentimentAlertsService],
})
export class SentimentAlertsModule {}
