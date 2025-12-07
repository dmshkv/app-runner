import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseConfig } from '../core/config/database.config';

// Feature Modules
import { SubmitCrawlRequestModule } from '../features/submit-crawl-request/submit-crawl-request.module';
import { ProcessCrawlResultsModule } from '../features/process-crawl-results/process-crawl-results.module';
import { QueryProcessModule } from '../features/query-process/query-process.module';
import { QueryUrlsModule } from '../features/query-urls/query-urls.module';
import { QueryResultsModule } from '../features/query-results/query-results.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      useClass: DatabaseConfig,
    }),
    // Features
    SubmitCrawlRequestModule,
    ProcessCrawlResultsModule,
    QueryProcessModule,
    QueryUrlsModule,
    QueryResultsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
