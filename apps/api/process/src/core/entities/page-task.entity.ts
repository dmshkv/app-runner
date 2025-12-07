import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CrawlRun } from './crawl-run.entity';
import { Product } from './product.entity';
import { LlmUsageLog } from './llm-usage-log.entity';

export enum PageTaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum PageType {
  PRODUCT = 'product',
  LISTING = 'listing',
  PAGINATION = 'pagination',
  OTHER = 'other',
  ERROR = 'error',
}

@Entity('page_tasks')
export class PageTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  crawlRunId: string;

  // URL information
  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  urlHash: string;

  @Column({ type: 'text', nullable: true })
  normalizedUrl?: string;

  // Task state
  @Column({
    type: 'enum',
    enum: PageTaskStatus,
    default: PageTaskStatus.QUEUED,
  })
  @Index()
  status: PageTaskStatus;

  @Column({ type: 'int', default: 0 })
  depth: number;

  // Fetch results
  @Column({ type: 'int', nullable: true })
  httpStatus?: number;

  @Column({ type: 'text', nullable: true })
  finalUrl?: string;

  @Column({ type: 'int', nullable: true })
  fetchDurationMs?: number;

  // Page analysis
  @Column({ type: 'enum', enum: PageType, nullable: true })
  @Index()
  pageType?: PageType;

  @Column({ type: 'varchar', length: 50, nullable: true })
  pageClassificationMethod?: string;

  // LLM usage for this page
  @Column({ type: 'int', default: 0 })
  llmRequests: number;

  @Column({ type: 'int', default: 0 })
  llmTokens: number;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  // Queue management
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  queuedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  // Parent task (for tracking navigation)
  @Column({ type: 'uuid', nullable: true })
  parentTaskId?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  discoveredFrom?: string;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CrawlRun, (crawlRun) => crawlRun.pageTasks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'crawl_run_id' })
  crawlRun: CrawlRun;

  @ManyToOne(() => PageTask, (pageTask) => pageTask.childTasks, {
    nullable: true,
  })
  @JoinColumn({ name: 'parent_task_id' })
  parentTask?: PageTask;

  @OneToMany(() => PageTask, (pageTask) => pageTask.parentTask)
  childTasks: PageTask[];

  @OneToMany(() => Product, (product) => product.pageTask)
  products: Product[];

  @OneToMany(() => LlmUsageLog, (log) => log.pageTask)
  llmUsageLogs: LlmUsageLog[];
}
