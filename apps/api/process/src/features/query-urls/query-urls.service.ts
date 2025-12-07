import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Url, UrlStatus } from '../../core/entities/url.entity';

@Injectable()
export class QueryUrlsService {
  private readonly logger = new Logger(QueryUrlsService.name);

  constructor(
    @InjectRepository(Url)
    private readonly urlRepository: Repository<Url>
  ) {}

  /**
   * Get all URLs with optional status filter
   * Use Case: User wants to view URLs by status
   */
  async findAll(status?: UrlStatus): Promise<Url[]> {
    const where = status ? { status } : {};
    return await this.urlRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single URL by ID
   * Use Case: User wants to view details of a specific URL
   */
  async findOne(id: string): Promise<Url> {
    const url = await this.urlRepository.findOne({ where: { id } });
    
    if (!url) {
      throw new NotFoundException(`URL with ID ${id} not found`);
    }
    
    return url;
  }

  /**
   * Get processing statistics
   * Use Case: User wants to see overall processing stats
   */
  async getStats() {
    const [pending, processing, completed, failed, total] = await Promise.all([
      this.urlRepository.count({ where: { status: UrlStatus.PENDING } }),
      this.urlRepository.count({ where: { status: UrlStatus.PROCESSING } }),
      this.urlRepository.count({ where: { status: UrlStatus.COMPLETED } }),
      this.urlRepository.count({ where: { status: UrlStatus.FAILED } }),
      this.urlRepository.count(),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      total,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(2) : 0,
    };
  }

  /**
   * Retry failed URLs by resetting their status
   * Use Case: User wants to retry URLs that previously failed
   */
  async retryFailedUrls(): Promise<number> {
    const failedUrls = await this.urlRepository.find({
      where: { status: UrlStatus.FAILED },
      take: 20,
    });

    let retryCount = 0;

    for (const url of failedUrls) {
      if (url.retryCount < url.maxRetries) {
        url.status = UrlStatus.PENDING;
        url.retryCount = 0;
        url.errorMessage = undefined;
        await this.urlRepository.save(url);
        retryCount++;
      }
    }

    this.logger.log(`Retrying ${retryCount} failed URLs`);
    return retryCount;
  }
}
