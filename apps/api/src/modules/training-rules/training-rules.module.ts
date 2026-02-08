import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TrainingRulesController } from './training-rules.controller';
import { TrainingRulesService } from './training-rules.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [TrainingRulesController],
  providers: [TrainingRulesService],
  exports: [TrainingRulesService],
})
export class TrainingRulesModule {}
