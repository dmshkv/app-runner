import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Url, UrlStatus } from '../../core/entities/url.entity';
import { Process, ProcessStatus } from '../../core/entities/process.entity';
import { SqsService } from '../../core/services/sqs.service';
import { CrawlStrategy } from '../../core/interfaces/crawler.interface';

export interface UrlRequest {
  url: string;
  selectors?: Record<string, string>;
  options?: {
    waitForSelector?: string;
    timeout?: number;
    extractFullHtml?: boolean;
    screenshot?: boolean;
    waitForNetworkIdle?: boolean;
  };
}

export interface InitiateProcessDto {
  urls: UrlRequest[];
  metadata?: Record<string, any>;
}

export interface InitiateProcessResponse {
  processId: string;
  totalUrls: number;
  urls: Array<{
    id: string;
    url: string;
    status: string;
  }>;
}

@Injectable()
export class SubmitCrawlRequestService {
  private readonly logger = new Logger(SubmitCrawlRequestService.name);

  constructor(
    @InjectRepository(Url)
    private readonly urlRepository: Repository<Url>,
    @InjectRepository(Process)
    private readonly processRepository: Repository<Process>,
    private readonly sqsService: SqsService
  ) {}

  /**
   * Initiate a new crawl process
   * Use Case: User initiates a batch crawl with multiple URLs
   */
  async initiateProcess(data: InitiateProcessDto): Promise<InitiateProcessResponse> {
    this.logger.log(`Initiating new process with ${data.urls.length} URLs`);

    // Step 1: Create Process entry
    const process = this.processRepository.create({
      status: ProcessStatus.INITIATED,
      totalUrls: data.urls.length,
      metadata: data.metadata,
    });
    await this.processRepository.save(process);

    this.logger.log(`Created process: ${process.id}`);

    // Step 2: Create URL entries linked to this process
    const urlEntities = data.urls.map((urlReq) =>
      this.urlRepository.create({
        processId: process.id,
        url: urlReq.url,
        selectors: urlReq.selectors,
        options: urlReq.options,
        status: UrlStatus.PENDING,
      })
    );

    const savedUrls = await this.urlRepository.save(urlEntities);

    // Step 3: Immediately send SQS events for each URL
    const sentUrls = [];
    let successCount = 0;

    for (const url of savedUrls) {
      try {
        await this.sendCrawlCommand(url);
        successCount++;
        sentUrls.push({
          id: url.id,
          url: url.url,
          status: url.status,
        });
      } catch (error) {
        this.logger.error(`Failed to send crawl command for URL ${url.url}:`, error);
        await this.markUrlAsFailed(url, error);
        sentUrls.push({
          id: url.id,
          url: url.url,
          status: UrlStatus.FAILED,
        });
      }
    }

    // Step 4: Update process status to IN_PROGRESS
    process.status = ProcessStatus.IN_PROGRESS;
    await this.processRepository.save(process);

    this.logger.log(`Process ${process.id} initiated: ${successCount}/${data.urls.length} URLs sent`);

    return {
      processId: process.id,
      totalUrls: data.urls.length,
      urls: sentUrls,
    };
  }

  /**
   * Send crawl command to SQS queue
   * Strategy: Always start with FULL_HTML to grab and clean the page
   */
  private async sendCrawlCommand(url: Url): Promise<void> {
    // Always send FULL_HTML strategy first
    await this.sqsService.sendFullHtmlCommand(
      url.url,
      url.id,
      {
        timeout: url.options?.timeout,
        waitForNetworkIdle: url.options?.waitForNetworkIdle,
      }
    );

    // Update status to processing
    url.status = UrlStatus.PROCESSING;
    await this.urlRepository.save(url);

    this.logger.log(`✅ Sent FULL_HTML crawl command for: ${url.url}`);
  }

  /**
   * Mark URL as failed
   */
  private async markUrlAsFailed(url: Url, error: any): Promise<void> {
    url.status = UrlStatus.FAILED;
    url.errorMessage = error.message || 'Failed to send crawl command';
    await this.urlRepository.save(url);
  }
}
