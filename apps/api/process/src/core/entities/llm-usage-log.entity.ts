import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CrawlRun } from './crawl-run.entity';
import { PageTask } from './page-task.entity';

export enum LlmRequestType {
  CLASSIFICATION = 'classification',
  EXTRACTION = 'extraction',
  RECIPE_GENERATION = 'recipe_generation',
  LINK_DISCOVERY = 'link_discovery',
}

@Entity('llm_usage_logs')
export class LlmUsageLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Context
  @Column({ type: 'uuid', nullable: true })
  @Index()
  crawlRunId?: string;

  @Column({ type: 'uuid', nullable: true })
  pageTaskId?: string;

  // LLM request details
  @Column({ type: 'enum', enum: LlmRequestType })
  @Index()
  requestType: LlmRequestType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model?: string;

  // Token usage
  @Column({ type: 'int', nullable: true })
  promptTokens?: number;

  @Column({ type: 'int', nullable: true })
  completionTokens?: number;

  @Column({ type: 'int', nullable: true })
  totalTokens?: number;

  // Cost calculation
  @Column({ type: 'decimal', precision: 10, scale: 4, nullable: true })
  estimatedCost?: number;

  // Performance
  @Column({ type: 'int', nullable: true })
  durationMs?: number;

  // Request/response (optional, for debugging)
  @Column({ type: 'text', nullable: true })
  promptSummary?: string;

  @Column({ type: 'text', nullable: true })
  responseSummary?: string;

  // Success tracking
  @Column({ type: 'boolean', default: true })
  wasSuccessful: boolean;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @CreateDateColumn()
  @Index()
  createdAt: Date;

  // Relations
  @ManyToOne(() => CrawlRun, (crawlRun) => crawlRun.llmUsageLogs, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'crawl_run_id' })
  crawlRun?: CrawlRun;

  @ManyToOne(() => PageTask, (pageTask) => pageTask.llmUsageLogs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'page_task_id' })
  pageTask?: PageTask;
}
