import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { SystemController } from './system.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ConnectwiseManageModule } from '../connectwise-manage/connectwise-manage.module';
import { OpenAIModule } from '../openai/openai.module';
import { VoipModule } from '../voip/voip.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ConnectwiseManageModule,
    OpenAIModule,
    VoipModule,
  ],
  controllers: [AdminController, SystemController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}

