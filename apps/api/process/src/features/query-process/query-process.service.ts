import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Process, ProcessStatus } from '../../core/entities/process.entity';
import { Url } from '../../core/entities/url.entity';
import { CrawlResult, CrawlResultStatus } from '../../core/entities/crawl-result.entity';
import { CrawlStrategy } from '../../core/interfaces/crawler.interface';

export interface ProcessStatusResponse {
  id: string;
  status: ProcessStatus;
  progress: {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    percentage: number;
  };
  results: Array<{
    urlId: string;
    url: string;
    status: string;
    selectors?: Record<string, string>;
    strategy?: {
      current: CrawlStrategy | null;
      fullHtml?: {
        cleanedHtml: string;
        cleanedHtmlLength: number;
      };
      template?: {
        extracted: Record<string, any>;
        screenshot?: string;
        screenshotSize?: number;
      };
    };
    errorMessage?: string;
  }>;
  metadata?: Record<string, any>;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

@Injectable()
export class QueryProcessService {
  private readonly logger = new Logger(QueryProcessService.name);

  constructor(
    @InjectRepository(Process)
    private readonly processRepository: Repository<Process>,
    @InjectRepository(Url)
    private readonly urlRepository: Repository<Url>,
    @InjectRepository(CrawlResult)
    private readonly crawlResultRepository: Repository<CrawlResult>
  ) {}

  /**
   * Get process status with progress and results
   * Use Case: User polls for process completion
   * Shows strategy-specific data: FULL_HTML and TEMPLATE results
   */
  async getProcessStatus(processId: string): Promise<ProcessStatusResponse> {
    this.logger.log(`Getting status for process: ${processId}`);

    // Get process
    const process = await this.processRepository.findOne({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process ${processId} not found`);
    }

    // Get all URLs for this process
    const urls = await this.urlRepository.find({
      where: { processId },
      order: { createdAt: 'ASC' },
    });

    // Get all crawl results for this process
    const crawlResults = await this.crawlResultRepository.find({
      where: { processId },
      order: { createdAt: 'ASC' },
    });

    // Group results by urlId and strategy
    const resultsByUrl = new Map<string, {
      fullHtml?: CrawlResult;
      template?: CrawlResult;
      latestStrategy?: CrawlStrategy;
    }>();

    crawlResults.forEach((result) => {
      if (!resultsByUrl.has(result.urlId)) {
        resultsByUrl.set(result.urlId, {});
      }
      
      const urlResults = resultsByUrl.get(result.urlId)!;
      
      if (result.strategy === CrawlStrategy.FULL_HTML) {
        urlResults.fullHtml = result;
        urlResults.latestStrategy = CrawlStrategy.FULL_HTML;
      } else if (result.strategy === CrawlStrategy.TEMPLATE) {
        urlResults.template = result;
        urlResults.latestStrategy = CrawlStrategy.TEMPLATE;
      }
    });

    // Build response with strategy-specific results
    const results = urls.map((url) => {
      const urlResults = resultsByUrl.get(url.id);
      const fullHtmlResult = urlResults?.fullHtml;
      const templateResult = urlResults?.template;
      
      return {
        urlId: url.id,
        url: url.url,
        status: url.status,
        selectors: url.selectors,
        strategy: {
          current: urlResults?.latestStrategy || null,
          fullHtml: fullHtmlResult ? {
            cleanedHtml: fullHtmlResult.cleanedHtml || '',
            cleanedHtmlLength: fullHtmlResult.cleanedHtmlLength || 0,
          } : undefined,
          template: templateResult ? {
            extracted: templateResult.extracted || {},
            screenshot: templateResult.screenshot,
            screenshotSize: templateResult.screenshotSize,
          } : undefined,
        },
        errorMessage: url.errorMessage || templateResult?.errorMessage || fullHtmlResult?.errorMessage,
      };
    });

    // Calculate progress
    const processingCount = urls.filter((u) => u.status === 'processing').length;
    const percentage = process.totalUrls > 0 
      ? Math.round(((process.completedUrls + process.failedUrls) / process.totalUrls) * 100)
      : 0;

    return {
      id: process.id,
      status: process.status,
      progress: {
        total: process.totalUrls,
        completed: process.completedUrls,
        failed: process.failedUrls,
        processing: processingCount,
        percentage,
      },
      results,
      metadata: process.metadata,
      errorMessage: process.errorMessage,
      createdAt: process.createdAt,
      completedAt: process.completedAt,
    };
  }

  /**
   * List all processes with optional status filter
   */
  async listProcesses(status?: ProcessStatus) {
    const where = status ? { status } : {};
    
    const processes = await this.processRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return processes.map((p) => ({
      id: p.id,
      status: p.status,
      totalUrls: p.totalUrls,
      completedUrls: p.completedUrls,
      failedUrls: p.failedUrls,
      createdAt: p.createdAt,
      completedAt: p.completedAt,
    }));
  }

  /**
   * Get process statistics
   */
  async getStats() {
    const [total, initiated, inProgress, completed, failed] = await Promise.all([
      this.processRepository.count(),
      this.processRepository.count({ where: { status: ProcessStatus.INITIATED } }),
      this.processRepository.count({ where: { status: ProcessStatus.IN_PROGRESS } }),
      this.processRepository.count({ where: { status: ProcessStatus.COMPLETED } }),
      this.processRepository.count({ where: { status: ProcessStatus.FAILED } }),
    ]);

    return {
      total,
      initiated,
      inProgress,
      completed,
      failed,
    };
  }
}
