import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { StorageModule } from './modules/storage/storage.module';
import { BullModule } from '@nestjs/bullmq';
import { VoipModule } from './modules/voip/voip.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { CallAnalysisModule } from './modules/call-analysis/call-analysis.module';
import { ConnectwiseManageModule } from './modules/connectwise-manage/connectwise-manage.module';
import { AuthModule } from './modules/auth/auth.module';
import { ClsModule } from 'nestjs-cls';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      // You can define a custom setup function if needed, e.g. for request ID
      // setup: (cls, req) => {
      //   cls.set('requestId', req.headers['x-request-id']);
      // },
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>(
            'REDIS_URL',
            'redis://localhost:6379/0',
          ),
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    StorageModule,
    VoipModule,
    TranscriptionModule,
    CallAnalysisModule,
    ConnectwiseManageModule,
    AuthModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'client'),
      exclude: ['/api/*'],
      renderPath: '*',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
