import { Module, forwardRef } from '@nestjs/common';
import { ResolutionKbService } from './resolution-kb.service';
import { ResolutionKbController } from './resolution-kb.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NvidiaModule } from '../nvidia/nvidia.module';
import { TriageModule } from '../triage/triage.module';

@Module({
  imports: [PrismaModule, NvidiaModule, forwardRef(() => TriageModule)],
  controllers: [ResolutionKbController],
  providers: [ResolutionKbService],
  exports: [ResolutionKbService],
})
export class ResolutionKbModule {}
