import { Injectable } from '@nestjs/common';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { 
  AnyCrawlCommand, 
  CrawlStrategy,
  FullHtmlCrawlCommand,
  TemplateCrawlCommand 
} from '../interfaces/crawler.interface';

@Injectable()
export class SqsService {
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;

  constructor() {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'ca-central-1',
    });
    
    this.queueUrl = process.env.SQS_CRAWL_QUEUE_URL || '';
    
    if (!this.queueUrl) {
      console.warn('⚠️ SQS_CRAWL_QUEUE_URL not configured');
    }
  }

  /**
   * Send a crawl command (any strategy)
   */
  async sendCrawlCommand(command: AnyCrawlCommand): Promise<void> {
    if (!this.queueUrl) {
      throw new Error('SQS_CRAWL_QUEUE_URL is not configured');
    }

    try {
      const result = await this.sqsClient.send(
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify(command),
          MessageAttributes: {
            type: {
              DataType: 'String',
              StringValue: command.type,
            },
            strategy: {
              DataType: 'String',
              StringValue: command.strategy,
            },
            url: {
              DataType: 'String',
              StringValue: command.url,
            },
          },
        })
      );

      console.log(`✅ Sent ${command.strategy} crawl command for ${command.url}`, result.MessageId);
    } catch (error) {
      console.error('❌ Failed to send SQS message:', error);
      throw error;
    }
  }

  /**
   * Send FULL_HTML strategy command
   */
  async sendFullHtmlCommand(
    url: string, 
    requestId: string,
    options?: { timeout?: number; waitForNetworkIdle?: boolean }
  ): Promise<void> {
    const command: FullHtmlCrawlCommand = {
      type: 'CRAWL',
      strategy: CrawlStrategy.FULL_HTML,
      url,
      requestId,
      timeout: options?.timeout,
      waitForNetworkIdle: options?.waitForNetworkIdle ?? true,
    };

    await this.sendCrawlCommand(command);
  }

  /**
   * Send TEMPLATE strategy command
   */
  async sendTemplateCommand(
    url: string,
    requestId: string,
    selectors: Record<string, string>,
    options?: {
      timeout?: number;
      waitForNetworkIdle?: boolean;
      waitForSelector?: string;
      screenshot?: boolean;
    }
  ): Promise<void> {
    const command: TemplateCrawlCommand = {
      type: 'CRAWL',
      strategy: CrawlStrategy.TEMPLATE,
      url,
      requestId,
      selectors,
      timeout: options?.timeout,
      waitForNetworkIdle: options?.waitForNetworkIdle ?? true,
      waitForSelector: options?.waitForSelector,
      screenshot: options?.screenshot,
    };

    await this.sendCrawlCommand(command);
  }

  /**
   * Send bulk crawl commands
   */
  async sendBulkCrawlCommands(commands: AnyCrawlCommand[]): Promise<void> {
    const promises = commands.map((command) => this.sendCrawlCommand(command));
    await Promise.all(promises);
  }
}
