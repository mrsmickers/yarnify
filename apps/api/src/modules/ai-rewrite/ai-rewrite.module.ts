import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiRewriteService } from './ai-rewrite.service';
import { AiRewriteController } from './ai-rewrite.controller';

@Module({
  imports: [ConfigModule],
  controllers: [AiRewriteController],
  providers: [AiRewriteService],
  exports: [AiRewriteService],
})
export class AiRewriteModule {}
