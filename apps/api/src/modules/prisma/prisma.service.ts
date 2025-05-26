/* eslint-disable @typescript-eslint/no-namespace */
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../../generated/prisma';
import { CallAnalysisOutput } from '../call-analysis/prompt';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

declare global {
  namespace PrismaJson {
    // you can use classes, interfaces, types, etc.
    type CallAnalysisData = CallAnalysisOutput;
  }
}
