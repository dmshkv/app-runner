import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from '../../core/entities/url.entity';
import { CrawlResult } from '../../core/entities/crawl-result.entity';
import { Process } from '../../core/entities/process.entity';
import { ProcessCrawlResultsService } from './process-crawl-results.service';
import { ProcessCrawlResultsListener } from './process-crawl-results.listener';
import { SqsService } from '../../core/services/sqs.service';

@Module({
  imports: [TypeOrmModule.forFeature([Url, CrawlResult, Process])],
  providers: [ProcessCrawlResultsService, ProcessCrawlResultsListener, SqsService],
  exports: [ProcessCrawlResultsService],
})
export class ProcessCrawlResultsModule {}
