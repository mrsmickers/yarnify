import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketingController } from './marketing.controller';
import { MarketingSyncService } from './marketing-sync.service';
import { EnchargeService } from './encharge.service';
import { ConnectwiseContactsService } from './connectwise-contacts.service';
import { HubspotDealsService } from './hubspot-deals.service';
import { MarketingSyncProducer } from './marketing-sync.producer';
import { MarketingSyncConsumer } from './marketing-sync.consumer';
import { MARKETING_SYNC_QUEUE } from './constants';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    PrismaModule,
    BullModule.registerQueue({
      name: MARKETING_SYNC_QUEUE,
    }),
  ],
  controllers: [MarketingController],
  providers: [
    MarketingSyncService,
    EnchargeService,
    ConnectwiseContactsService,
    HubspotDealsService,
    MarketingSyncProducer,
    MarketingSyncConsumer,
  ],
})
export class MarketingModule {}
