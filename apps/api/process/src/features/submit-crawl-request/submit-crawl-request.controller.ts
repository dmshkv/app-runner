import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { 
  SubmitCrawlRequestService, 
  InitiateProcessDto,
  InitiateProcessResponse 
} from './submit-crawl-request.service';

@Controller('process')
export class SubmitCrawlRequestController {
  private readonly logger = new Logger(SubmitCrawlRequestController.name);

  constructor(
    private readonly submitCrawlRequestService: SubmitCrawlRequestService
  ) {}

  /**
   * API Endpoint: Initiate a new crawl process
   * POST /api/process/initiate
   */
  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  async initiateProcess(@Body() dto: InitiateProcessDto): Promise<InitiateProcessResponse> {
    this.logger.log(`API: Initiating process with ${dto.urls.length} URLs`);
    return await this.submitCrawlRequestService.initiateProcess(dto);
  }
}
