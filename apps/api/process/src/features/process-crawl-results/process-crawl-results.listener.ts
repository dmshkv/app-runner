import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  Message,
} from '@aws-sdk/client-sqs';
import { ProcessCrawlResultsService } from './process-crawl-results.service';
import { CrawlResultMessage, CrawlResultData } from '../../core/interfaces/crawler.interface';

@Injectable()
export class ProcessCrawlResultsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProcessCrawlResultsListener.name);
  private readonly sqsClient: SQSClient;
  private readonly resultsQueueUrl: string;
  private isRunning = false;
  private pollingTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly processCrawlResultsService: ProcessCrawlResultsService
  ) {
    this.sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'ca-central-1',
    });

    this.resultsQueueUrl = process.env.SQS_RESULTS_QUEUE_URL || '';

    if (!this.resultsQueueUrl) {
      this.logger.warn('⚠️ SQS_RESULTS_QUEUE_URL not configured. Result listener disabled.');
    }
  }

  /**
   * Event Handler: Start listening when module initializes
   */
  async onModuleInit() {
    if (this.resultsQueueUrl) {
      this.logger.log('🎧 Starting SQS result listener...');
      await this.startListening();
    }
  }

  /**
   * Event Handler: Stop listening when module destroys
   */
  async onModuleDestroy() {
    this.logger.log('🛑 Stopping SQS result listener...');
    await this.stopListening();
  }

  /**
   * Start listening for SQS messages
   */
  private async startListening() {
    this.isRunning = true;
    this.poll();
  }

  /**
   * Stop listening
   */
  private async stopListening() {
    this.isRunning = false;
    if (this.pollingTimeout) {
      clearTimeout(this.pollingTimeout);
      this.pollingTimeout = null;
    }
  }

  /**
   * Poll for messages (long polling)
   */
  private async poll() {
    if (!this.isRunning) {
      return;
    }

    try {
      const messages = await this.receiveMessages();

      if (messages && messages.length > 0) {
        this.logger.log(`📨 SQS Event: Received ${messages.length} result(s)`);

        for (const message of messages) {
          await this.handleMessage(message);
        }
      }
    } catch (error) {
      this.logger.error('Error polling SQS:', error);
    }

    // Schedule next poll
    this.pollingTimeout = setTimeout(() => this.poll(), 1000);
  }

  /**
   * Receive messages from SQS
   */
  private async receiveMessages(): Promise<Message[]> {
    try {
      const result = await this.sqsClient.send(
        new ReceiveMessageCommand({
          QueueUrl: this.resultsQueueUrl,
          MaxNumberOfMessages: 10,
          WaitTimeSeconds: 20, // Long polling
          MessageAttributeNames: ['All'],
        })
      );

      return result.Messages || [];
    } catch (error) {
      this.logger.error('Failed to receive messages:', error);
      return [];
    }
  }

  /**
   * Handle a single SQS message
   */
  private async handleMessage(message: Message) {
    try {
      if (!message.Body) {
        this.logger.warn('Received message without body');
        return;
      }

      const crawlData = this.parseMessage(message.Body);

      this.logger.log(`Processing result for: ${crawlData.url}`);

      // Process the result
      await this.processCrawlResultsService.processResult(crawlData);

      // Delete message after successful processing
      await this.deleteMessage(message.ReceiptHandle!);

      this.logger.log(`✅ Successfully processed result for: ${crawlData.url}`);
    } catch (error) {
      this.logger.error('Failed to process message:', error);
      this.logger.error('Message body:', message.Body);
      // Message will be retried or moved to DLQ
    }
  }

  /**
   * Parse message body (handles both direct SQS and SNS-wrapped messages)
   */
  private parseMessage(body: string): CrawlResultData {
    const parsed = JSON.parse(body);

    // Direct SQS message format
    if (parsed.body && parsed.statusCode !== undefined) {
      return (parsed as CrawlResultMessage).body;
    }

    // SNS notification format
    if (parsed.Message) {
      const snsMessage = JSON.parse(parsed.Message);
      if (snsMessage.body) {
        return snsMessage.body;
      }
      return snsMessage as CrawlResultData;
    }

    // Direct result data
    return parsed as CrawlResultData;
  }

  /**
   * Delete message from queue
   */
  private async deleteMessage(receiptHandle: string) {
    try {
      await this.sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: this.resultsQueueUrl,
          ReceiptHandle: receiptHandle,
        })
      );
    } catch (error) {
      this.logger.error('Failed to delete message:', error);
    }
  }
}
