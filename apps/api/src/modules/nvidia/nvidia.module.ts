import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NvidiaService } from './nvidia.service';

@Module({
  imports: [ConfigModule],
  providers: [NvidiaService],
  exports: [NvidiaService],
})
export class NvidiaModule {}
