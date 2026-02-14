import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TriageService } from './triage.service';
import { TriageWebhookController, TriageAdminController } from './triage.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NvidiaModule } from '../nvidia/nvidia.module';
import { ConnectwiseManageModule } from '../connectwise-manage/connectwise-manage.module';
import { ManageAPI } from 'connectwise-rest';
import { TRIAGE_CW_API } from './triage.constants';
import { ResolutionKbModule } from '../resolution-kb/resolution-kb.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    NvidiaModule,
    ConnectwiseManageModule,
    forwardRef(() => ResolutionKbModule),
  ],
  controllers: [TriageWebhookController, TriageAdminController],
  providers: [
    TriageService,
    {
      provide: TRIAGE_CW_API,
      useFactory: (configService: ConfigService) => {
        return new ManageAPI({
          companyId: configService.getOrThrow<string>('CONNECTWISE_COMPANY_ID'),
          companyUrl: configService.getOrThrow<string>('CONNECTWISE_URL'),
          publicKey: configService.get<string>('TRIAGE_CW_PUBLIC_KEY') ||
            configService.getOrThrow<string>('CONNECTWISE_PUBLIC_KEY'),
          privateKey: configService.get<string>('TRIAGE_CW_PRIVATE_KEY') ||
            configService.getOrThrow<string>('CONNECTWISE_PRIVATE_KEY'),
          clientId: configService.get<string>('TRIAGE_CW_CLIENT_ID') ||
            configService.getOrThrow<string>('CONNECTWISE_CLIENT_ID'),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [TriageService, TRIAGE_CW_API],
})
export class TriageModule {}
