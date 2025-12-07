import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { QueryResultsService } from './query-results.service';

@Controller('results')
export class QueryResultsController {
  private readonly logger = new Logger(QueryResultsController.name);

  constructor(private readonly queryResultsService: QueryResultsService) {}

  /**
   * API Endpoint: Get all results with optional URL filter
   * GET /api/results?urlId=xxx
   */
  @Get()
  async findAll(@Query('urlId') urlId?: string) {
    this.logger.log(`API: Getting results${urlId ? ` for URL ${urlId}` : ''}`);
    return await this.queryResultsService.findAll(urlId);
  }

  /**
   * API Endpoint: Get result statistics
   * GET /api/results/stats
   */
  @Get('stats')
  async getStats() {
    this.logger.log('API: Getting result statistics');
    return await this.queryResultsService.getStats();
  }

  /**
   * API Endpoint: Get result by ID
   * GET /api/results/:id
   */
  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`API: Getting result by ID: ${id}`);
    return await this.queryResultsService.findOne(id);
  }
}
