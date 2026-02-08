import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CompanyInfoController } from './company-info.controller';
import { CompanyInfoService } from './company-info.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompanyInfoController],
  providers: [CompanyInfoService],
  exports: [CompanyInfoService],
})
export class CompanyInfoModule {}
