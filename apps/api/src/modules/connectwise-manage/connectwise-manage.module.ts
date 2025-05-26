import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ConnectwiseManageService } from './connectwise-manage.service';
import { ManageAPI } from 'connectwise-rest';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ManageAPI,
      useFactory: (configService: ConfigService) => {
        return new ManageAPI({
          companyId: configService.getOrThrow<string>('CONNECTWISE_COMPANY_ID'),
          companyUrl: configService.getOrThrow<string>('CONNECTWISE_URL'),
          publicKey: configService.getOrThrow<string>('CONNECTWISE_PUBLIC_KEY'),
          privateKey: configService.getOrThrow<string>(
            'CONNECTWISE_PRIVATE_KEY',
          ),
          clientId: configService.getOrThrow<string>('CONNECTWISE_CLIENT_ID'),
        });
      },
      inject: [ConfigService],
    },
    ConnectwiseManageService,
  ],
  exports: [ConnectwiseManageService],
})
export class ConnectwiseManageModule {}
