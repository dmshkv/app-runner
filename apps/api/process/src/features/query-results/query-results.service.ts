import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrawlResult } from '../../core/entities/crawl-result.entity';

@Injectable()
export class QueryResultsService {
  private readonly logger = new Logger(QueryResultsService.name);

  constructor(
    @InjectRepository(CrawlResult)
    private readonly crawlResultRepository: Repository<CrawlResult>
  ) {}

  /**
   * Get all crawl results with optional URL filter
   * Use Case: User wants to view crawl results
   */
  async findAll(urlId?: string): Promise<CrawlResult[]> {
    const where = urlId ? { urlId } : {};
    return await this.crawlResultRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['url'],
    });
  }

  /**
   * Get a single crawl result by ID
   * Use Case: User wants to view details of a specific result
   */
  async findOne(id: string): Promise<CrawlResult> {
    const result = await this.crawlResultRepository.findOne({
      where: { id },
      relations: ['url'],
    });

    if (!result) {
      throw new NotFoundException(`Crawl result with ID ${id} not found`);
    }

    return result;
  }

  /**
   * Get latest result for a URL
   * Use Case: User wants the most recent crawl result for a URL
   */
  async findLatestByUrl(urlId: string): Promise<CrawlResult | null> {
    return await this.crawlResultRepository.findOne({
      where: { urlId },
      order: { createdAt: 'DESC' },
      relations: ['url'],
    });
  }

  /**
   * Get statistics
   * Use Case: User wants to see overall result statistics
   */
  async getStats() {
    const total = await this.crawlResultRepository.count();
    const successful = await this.crawlResultRepository.count({
      where: { statusCode: 200 },
    });
    const failed = total - successful;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
    };
  }
}
