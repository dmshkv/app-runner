import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryUrlsService } from './query-urls.service';
import { UrlStatus } from '../../core/entities/url.entity';

@Controller('urls')
export class QueryUrlsController {
  private readonly logger = new Logger(QueryUrlsController.name);

  constructor(private readonly queryUrlsService: QueryUrlsService) {}

  /**
   * API Endpoint: Get all URLs with optional status filter
   * GET /api/urls?status=pending
   */
  @Get()
  async findAll(@Query('status') status?: UrlStatus) {
    this.logger.log(`API: Getting URLs${status ? ` with status=${status}` : ''}`);
    return await this.queryUrlsService.findAll(status);
  }

  /**
   * API Endpoint: Get processing statistics
   * GET /api/urls/stats
   */
  @Get('stats')
  async getStats() {
    this.logger.log('API: Getting URL statistics');
    return await this.queryUrlsService.getStats();
  }

  /**
   * API Endpoint: Get URL by ID
   * GET /api/urls/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`API: Getting URL by ID: ${id}`);
    return await this.queryUrlsService.findOne(id);
  }

  /**
   * API Endpoint: Retry failed URLs
   * POST /api/urls/retry-failed
   */
  @Post('retry-failed')
  @HttpCode(HttpStatus.OK)
  async retryFailed() {
    this.logger.log('API: Retrying failed URLs');
    const count = await this.queryUrlsService.retryFailedUrls();
    return {
      message: `Retrying ${count} failed URLs`,
      count,
    };
  }
}
