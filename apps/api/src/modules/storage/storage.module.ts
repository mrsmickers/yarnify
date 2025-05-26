import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';
import { StorageController } from './storage.controller';
import { CallRepository } from '../call-analysis/repositories/call.repository';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [ConfigModule], // ConfigModule is needed for StorageService
  controllers: [StorageController],
  providers: [StorageService, CallRepository, PrismaService],
  exports: [StorageService],
})
export class StorageModule {}
