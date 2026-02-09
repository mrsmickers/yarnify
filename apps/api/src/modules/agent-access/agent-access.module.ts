import { Module } from '@nestjs/common';
import { AgentAccessService } from './agent-access.service';
import { AgentAccessController } from './agent-access.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PrismaModule, PermissionsModule],
  controllers: [AgentAccessController],
  providers: [AgentAccessService],
  exports: [AgentAccessService],
})
export class AgentAccessModule {}
