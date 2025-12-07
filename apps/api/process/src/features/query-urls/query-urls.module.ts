import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from '../../core/entities/url.entity';
import { QueryUrlsController } from './query-urls.controller';
import { QueryUrlsService } from './query-urls.service';

@Module({
  imports: [TypeOrmModule.forFeature([Url])],
  controllers: [QueryUrlsController],
  providers: [QueryUrlsService],
  exports: [QueryUrlsService],
})
export class QueryUrlsModule {}
