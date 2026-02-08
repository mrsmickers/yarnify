import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PromptManagementController } from './prompt-management.controller';
import { LLMConfigController } from './llm-config.controller';
import { PromptManagementService } from './prompt-management.service';
import { LLMConfigService } from './llm-config.service';
import { PromptVariableResolverService } from './prompt-variable-resolver.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PromptManagementController, LLMConfigController],
  providers: [PromptManagementService, LLMConfigService, PromptVariableResolverService],
  exports: [PromptManagementService, LLMConfigService, PromptVariableResolverService],
})
export class PromptManagementModule {}

