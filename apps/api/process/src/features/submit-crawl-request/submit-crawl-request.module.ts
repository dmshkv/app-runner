import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from '../../core/entities/url.entity';
import { Process } from '../../core/entities/process.entity';
import { SqsService } from '../../core/services/sqs.service';
import { SubmitCrawlRequestController } from './submit-crawl-request.controller';
import { SubmitCrawlRequestService } from './submit-crawl-request.service';

@Module({
  imports: [TypeOrmModule.forFeature([Url, Process])],
  controllers: [SubmitCrawlRequestController],
  providers: [SubmitCrawlRequestService, SqsService],
  exports: [SubmitCrawlRequestService],
})
export class SubmitCrawlRequestModule {}
