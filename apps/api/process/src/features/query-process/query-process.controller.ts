import {
  Controller,
  Get,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QueryProcessService, ProcessStatusResponse } from './query-process.service';
import { ProcessStatus } from '../../core/entities/process.entity';

@Controller('process')
export class QueryProcessController {
  private readonly logger = new Logger(QueryProcessController.name);

  constructor(private readonly queryProcessService: QueryProcessService) {}

  /**
   * API Endpoint: Get process status with progress and results
   * GET /api/process/:id
   * 
   * Returns progress like "2/30 crawled" and detailed results
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getProcessStatus(
    @Param('id') id: string
  ): Promise<ProcessStatusResponse> {
    this.logger.log(`API: Getting process status: ${id}`);
    return await this.queryProcessService.getProcessStatus(id);
  }

  /**
   * API Endpoint: List all processes
   * GET /api/process
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async listProcesses(@Query('status') status?: ProcessStatus) {
    this.logger.log(`API: Listing processes with status: ${status || 'all'}`);
    return await this.queryProcessService.listProcesses(status);
  }

  /**
   * API Endpoint: Get process statistics
   * GET /api/process/stats/summary
   */
  @Get('stats/summary')
  @HttpCode(HttpStatus.OK)
  async getStats() {
    this.logger.log('API: Getting process statistics');
    return await this.queryProcessService.getStats();
  }
}
