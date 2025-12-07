import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Process } from '../../core/entities/process.entity';
import { Url } from '../../core/entities/url.entity';
import { CrawlResult } from '../../core/entities/crawl-result.entity';
import { QueryProcessController } from './query-process.controller';
import { QueryProcessService } from './query-process.service';

@Module({
  imports: [TypeOrmModule.forFeature([Process, Url, CrawlResult])],
  controllers: [QueryProcessController],
  providers: [QueryProcessService],
  exports: [QueryProcessService],
})
export class QueryProcessModule {}
