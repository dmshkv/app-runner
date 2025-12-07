import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrawlResult } from '../../core/entities/crawl-result.entity';
import { QueryResultsController } from './query-results.controller';
import { QueryResultsService } from './query-results.service';

@Module({
  imports: [TypeOrmModule.forFeature([CrawlResult])],
  controllers: [QueryResultsController],
  providers: [QueryResultsService],
  exports: [QueryResultsService],
})
export class QueryResultsModule {}
