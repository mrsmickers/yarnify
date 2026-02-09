import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Agent, Prisma } from '../../../../generated/prisma';

@Injectable()
export class AgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(
    email: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent | null> {
    return prisma.agent.findFirst({
      where: { email },
    });
  }

  async findByExtension(
    extension: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent | null> {
    return prisma.agent.findUnique({
      where: { extension },
    });
  }

  async findByName(
    name: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent | null> {
    // Case-insensitive search for agent by name
    return prisma.agent.findFirst({
      where: { 
        name: { 
          equals: name, 
          mode: 'insensitive' 
        } 
      },
    });
  }

  async create(
    data: Prisma.AgentCreateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent> {
    return prisma.agent.create({ data });
  }

  async findById(
    id: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent | null> {
    return prisma.agent.findUnique({
      where: { id },
      include: {
        calls: true,
      },
    });
  }

  async update(
    id: string,
    data: Prisma.AgentUpdateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent> {
    return prisma.agent.update({
      where: { id },
      data,
    });
  }

  async findMany(
    args: Prisma.AgentFindManyArgs,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent[]> {
    return prisma.agent.findMany(args);
  }

  async count(
    args: Prisma.AgentCountArgs,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return prisma.agent.count(args);
  }

  async findAllWithRelations(
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent[]> {
    return prisma.agent.findMany({
      include: {
        entraUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
            contextBox: true,
          },
        },
        _count: {
          select: {
            calls: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findByIdWithRelations(
    id: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent | null> {
    return prisma.agent.findUnique({
      where: { id },
      include: {
        entraUser: {
          select: {
            id: true,
            email: true,
            displayName: true,
            contextBox: true,
          },
        },
        _count: {
          select: {
            calls: true,
          },
        },
      },
    });
  }

  async upsertByExtension(
    extension: string,
    name: string,
    email?: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Agent> {
    return prisma.agent.upsert({
      where: { extension },
      create: {
        name,
        extension,
        email: email || null,
      },
      update: {
        name,
        email: email || null,
      },
    });
  }
}
