import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Call, Prisma } from '../../../../generated/prisma'; // Corrected import path

@Injectable()
export class CallRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCallSid(
    callSid: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Call | null> {
    return prisma.call.findFirst({
      where: { callSid },
    });
  }

  async create(
    data: Prisma.CallUncheckedCreateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Call> {
    return prisma.call.create({ data });
  }

  async update(
    id: string,
    data: Prisma.CallUncheckedUpdateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Call> {
    return prisma.call.update({
      where: { id },
      data,
    });
  }

  async findMany(
    args: Prisma.CallFindManyArgs,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Prisma.CallGetPayload<typeof args>[]> {
    return prisma.call.findMany(args);
  }

  async count(
    args: Prisma.CallCountArgs,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return prisma.call.count(args);
  }

  async findById(
    id: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Call | null> {
    return prisma.call.findUnique({
      where: { id },
      include: {
        analysis: true, // Include related CallAnalysis
        company: true, // Include related Company
        Agents: true, // Include related Agent
      },
    });
  }
}
