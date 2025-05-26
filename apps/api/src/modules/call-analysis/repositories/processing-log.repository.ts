import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ProcessingLog, Prisma } from '../../../../generated/prisma';

@Injectable()
export class ProcessingLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.ProcessingLogUncheckedCreateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<ProcessingLog> {
    return prisma.processingLog.create({ data });
  }
}
