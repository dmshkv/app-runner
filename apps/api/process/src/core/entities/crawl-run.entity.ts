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
import { SiteConfig } from './site-config.entity';
import { LlmRecipe } from './llm-recipe.entity';
import { PageTask } from './page-task.entity';
import { Product } from './product.entity';
import { LlmUsageLog } from './llm-usage-log.entity';

export enum CrawlRunStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  STOPPED = 'stopped',
  TIMEOUT = 'timeout',
}

@Entity('crawl_runs')
@Index(['siteConfigId', 'runNumber'], { unique: true })
export class CrawlRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  siteConfigId: string;

  // Run identification
  @Column({ type: 'int' })
  runNumber: number;

  // Status tracking
  @Column({
    type: 'enum',
    enum: CrawlRunStatus,
    default: CrawlRunStatus.RUNNING,
  })
  @Index()
  status: CrawlRunStatus;

  // Progress metrics
  @Column({ type: 'int', default: 0 })
  pagesVisited: number;

  @Column({ type: 'int', default: 0 })
  pagesQueued: number;

  @Column({ type: 'int', default: 0 })
  productsFound: number;

  // LLM usage tracking (cost analysis)
  @Column({ type: 'int', default: 0 })
  llmRequestsClassification: number;

  @Column({ type: 'int', default: 0 })
  llmRequestsExtraction: number;

  @Column({ type: 'int', default: 0 })
  llmRequestsRecipeGeneration: number;

  @Column({ type: 'int', default: 0 })
  llmTotalTokens: number;

  @Column({ type: 'decimal', precision: 10, scale: 4, default: 0 })
  llmTotalCost: number;

  // Recipe usage
  @Column({ type: 'uuid', nullable: true })
  llmRecipeId?: string;

  @Column({ type: 'int', default: 0 })
  recipeFallbackCount: number;

  // Timing
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Index()
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  durationSeconds?: number;

  // Error tracking
  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', default: 0 })
  errorCount: number;

  // Stop conditions
  @Column({ type: 'varchar', length: 100, nullable: true })
  stopReason?: string;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => SiteConfig, (siteConfig) => siteConfig.crawlRuns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'site_config_id' })
  siteConfig: SiteConfig;

  @ManyToOne(() => LlmRecipe, (recipe) => recipe.crawlRuns, {
    nullable: true,
  })
  @JoinColumn({ name: 'llm_recipe_id' })
  llmRecipe?: LlmRecipe;

  @OneToMany(() => PageTask, (pageTask) => pageTask.crawlRun)
  pageTasks: PageTask[];

  @OneToMany(() => Product, (product) => product.crawlRun)
  products: Product[];

  @OneToMany(() => LlmUsageLog, (log) => log.crawlRun)
  llmUsageLogs: LlmUsageLog[];
}
