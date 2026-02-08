import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// SPA fallback is now handled in main.ts
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { StorageModule } from './modules/storage/storage.module';
import { BullModule } from '@nestjs/bullmq';
import { VoipModule } from './modules/voip/voip.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';
import { CallAnalysisModule } from './modules/call-analysis/call-analysis.module';
import { ConnectwiseManageModule } from './modules/connectwise-manage/connectwise-manage.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { ClsModule } from 'nestjs-cls';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { TextChunkingModule } from './modules/text-chunking/text-chunking.module';
import { PromptManagementModule } from './modules/prompt-management/prompt-management.module';
import { NvidiaModule } from './modules/nvidia/nvidia.module';
import { CompanyInfoModule } from './modules/company-info/company-info.module';
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
    AdminModule,
    EmbeddingModule,
    TextChunkingModule,
    PromptManagementModule,
    NvidiaModule,
    CompanyInfoModule,
    // Serve frontend static files in production (SPA with client-side routing)
    // __dirname in dist is /app/apps/api/dist/src, client is at /app/apps/api/client
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'client'),
      exclude: ['/api/*', '/api/v1/*'],
      serveStaticOptions: {
        index: false, // Don't serve index.html for directories
        fallthrough: true, // Allow NestJS to handle 404s
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
