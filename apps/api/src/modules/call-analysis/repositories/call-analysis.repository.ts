import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CallAnalysis, Prisma } from '../../../../generated/prisma';

@Injectable()
export class CallAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.CallAnalysisUncheckedCreateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<CallAnalysis> {
    return prisma.callAnalysis.create({ data });
  }
}
