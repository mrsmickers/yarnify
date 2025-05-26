import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Company, Prisma } from '../../../../generated/prisma';

@Injectable()
export class CompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByConnectwiseId(
    connectwiseId: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Company | null> {
    return prisma.company.findUnique({
      where: { connectwiseId },
    });
  }

  async create(
    data: Prisma.CompanyCreateInput,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Company> {
    return prisma.company.create({ data });
  }

  async findOrCreate(
    connectwiseId: string,
    name: string,
    prisma: Prisma.TransactionClient = this.prisma,
  ): Promise<Company> {
    const existingCompany = await this.findByConnectwiseId(
      connectwiseId,
      prisma,
    );
    if (existingCompany) {
      return existingCompany;
    }
    return this.create({ connectwiseId, name }, prisma);
  }
}
