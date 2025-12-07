import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlResult, CrawlResultStatus } from '../../core/entities/crawl-result.entity';
import { Url, UrlStatus } from '../../core/entities/url.entity';
import { Process, ProcessStatus } from '../../core/entities/process.entity';
import { 
  CrawlResultData, 
  CrawlStrategy,
  FullHtmlResultData,
  TemplateResultData 
} from '../../core/interfaces/crawler.interface';
import { SqsService } from '../../core/services/sqs.service';

@Injectable()
export class ProcessCrawlResultsService {
  private readonly logger = new Logger(ProcessCrawlResultsService.name);

  constructor(
    @InjectRepository(CrawlResult)
    private readonly crawlResultRepository: Repository<CrawlResult>,
    @InjectRepository(Url)
    private readonly urlRepository: Repository<Url>,
    @InjectRepository(Process)
    private readonly processRepository: Repository<Process>,
    private readonly sqsService: SqsService
  ) {}

  /**
   * Process crawl result from SQS event
   * Strategy-based workflow:
   * - FULL_HTML: Store cleaned HTML, trigger TEMPLATE strategy
   * - TEMPLATE: Store extracted data, mark URL as complete
   */
  async processResult(data: CrawlResultData): Promise<CrawlResult> {
    this.logger.log(`Processing ${data.strategy} result for: ${data.url}`);

    // Find the URL entity
    const urlEntity = await this.findUrlEntity(data);

    if (!urlEntity) {
      this.logger.warn(`URL entity not found for: ${data.url}`);
      throw new Error(`URL entity not found for requestId: ${data.requestId}`);
    }

    // Handle strategy-specific logic
    if (data.strategy === CrawlStrategy.FULL_HTML) {
      return await this.handleFullHtmlResult(urlEntity, data as FullHtmlResultData);
    } else {
      return await this.handleTemplateResult(urlEntity, data as TemplateResultData);
    }
  }

  /**
   * Handle FULL_HTML strategy result
   * - Store cleaned HTML
   * - Trigger TEMPLATE strategy for same URL
   */
  private async handleFullHtmlResult(
    urlEntity: Url,
    data: FullHtmlResultData
  ): Promise<CrawlResult> {
    this.logger.log(`Handling FULL_HTML result for: ${data.url}`);

    // Store FULL_HTML result
    const crawlResult = this.crawlResultRepository.create({
      urlId: urlEntity.id,
      processId: urlEntity.processId,
      sourceUrl: data.url,
      title: data.title,
      cleanedHtml: data.cleanedHtml,
      cleanedHtmlLength: data.cleanedHtmlLength,
      statusCode: data.statusCode,
      errorMessage: data.errorMessage,
      requestId: data.requestId,
      strategy: CrawlStrategy.FULL_HTML,
      status: CrawlResultStatus.FULL_HTML,
    });

    await this.crawlResultRepository.save(crawlResult);

    // If successful, trigger TEMPLATE strategy
    if (data.statusCode && data.statusCode >= 200 && data.statusCode < 300) {
      this.logger.log(`FULL_HTML successful, triggering TEMPLATE strategy for: ${data.url}`);
      
      // Send TEMPLATE command if selectors are available
      if (urlEntity.selectors && Object.keys(urlEntity.selectors).length > 0) {
        await this.sqsService.sendTemplateCommand(
          urlEntity.url,
          urlEntity.id,
          urlEntity.selectors,
          {
            timeout: urlEntity.options?.timeout,
            waitForNetworkIdle: urlEntity.options?.waitForNetworkIdle,
            waitForSelector: urlEntity.options?.waitForSelector,
            screenshot: urlEntity.options?.screenshot,
          }
        );
        this.logger.log(`✅ Sent TEMPLATE command for: ${urlEntity.url}`);
      } else {
        // No selectors, mark as completed with FULL_HTML only
        this.logger.log(`No selectors provided, marking as completed with FULL_HTML only`);
        urlEntity.status = UrlStatus.COMPLETED;
        urlEntity.processedAt = new Date();
        await this.urlRepository.save(urlEntity);
        
        crawlResult.status = CrawlResultStatus.COMPLETED;
        await this.crawlResultRepository.save(crawlResult);
        
        await this.checkProcessCompletion(urlEntity.processId);
      }
    } else {
      // Failed, mark URL as failed
      urlEntity.status = UrlStatus.FAILED;
      urlEntity.errorMessage = data.errorMessage || `FULL_HTML failed with status ${data.statusCode}`;
      await this.urlRepository.save(urlEntity);
      
      await this.checkProcessCompletion(urlEntity.processId);
    }

    return crawlResult;
  }

  /**
   * Handle TEMPLATE strategy result
   * - Store extracted data
   * - Mark URL as complete
   */
  private async handleTemplateResult(
    urlEntity: Url,
    data: TemplateResultData
  ): Promise<CrawlResult> {
    this.logger.log(`Handling TEMPLATE result for: ${data.url}`);

    // Store TEMPLATE result
    const crawlResult = this.crawlResultRepository.create({
      urlId: urlEntity.id,
      processId: urlEntity.processId,
      sourceUrl: data.url,
      title: data.title,
      extracted: data.extracted,
      screenshot: data.screenshot,
      screenshotSize: data.screenshotSize,
      statusCode: data.statusCode,
      errorMessage: data.errorMessage,
      requestId: data.requestId,
      strategy: CrawlStrategy.TEMPLATE,
      status: CrawlResultStatus.COMPLETED,
    });

    await this.crawlResultRepository.save(crawlResult);

    // Update URL status
    const isSuccess = data.statusCode && data.statusCode >= 200 && data.statusCode < 300;

    if (isSuccess) {
      urlEntity.status = UrlStatus.COMPLETED;
      urlEntity.processedAt = new Date();
      urlEntity.errorMessage = undefined;
      this.logger.log(`✅ TEMPLATE completed successfully for: ${data.url}`);
    } else {
      urlEntity.status = UrlStatus.FAILED;
      urlEntity.errorMessage = data.errorMessage || `TEMPLATE failed with status ${data.statusCode}`;
      this.logger.warn(`❌ TEMPLATE failed for: ${data.url}`);
    }

    await this.urlRepository.save(urlEntity);

    // Check process completion
    await this.checkProcessCompletion(urlEntity.processId);

    return crawlResult;
  }

  /**
   * Find URL entity by requestId
   */
  private async findUrlEntity(data: CrawlResultData): Promise<Url | null> {
    if (!data.requestId) {
      this.logger.warn('No requestId in crawl result data');
      return null;
    }

    return await this.urlRepository.findOne({
      where: { id: data.requestId },
    });
  }

  /**
   * Check if all URLs in a process are completed and update process status
   */
  private async checkProcessCompletion(processId: string): Promise<void> {
    const process = await this.processRepository.findOne({
      where: { id: processId },
    });

    if (!process) {
      this.logger.warn(`Process not found: ${processId}`);
      return;
    }

    // Get URL statistics for this process
    const [totalUrls, completedUrls, failedUrls, processingUrls] = await Promise.all([
      this.urlRepository.count({ where: { processId } }),
      this.urlRepository.count({ where: { processId, status: UrlStatus.COMPLETED } }),
      this.urlRepository.count({ where: { processId, status: UrlStatus.FAILED } }),
      this.urlRepository.count({ where: { processId, status: UrlStatus.PROCESSING } }),
    ]);

    // Update process counters
    process.completedUrls = completedUrls;
    process.failedUrls = failedUrls;

    // Check if all URLs are done (no more processing)
    if (processingUrls === 0) {
      if (failedUrls === totalUrls) {
        // All failed
        process.status = ProcessStatus.FAILED;
        process.errorMessage = 'All URLs failed to process';
      } else {
        // At least some succeeded
        process.status = ProcessStatus.COMPLETED;
        if (failedUrls > 0) {
          process.errorMessage = `${failedUrls} out of ${totalUrls} URLs failed`;
        }
      }
      process.completedAt = new Date();
      
      this.logger.log(`Process ${processId} completed: ${completedUrls} succeeded, ${failedUrls} failed`);
    }

    await this.processRepository.save(process);
  }
}
