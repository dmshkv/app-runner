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
import { CrawlRun } from './crawl-run.entity';

@Entity('llm_recipes')
@Index(['siteConfigId', 'version'], { unique: true })
export class LlmRecipe {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  siteConfigId: string;

  // Recipe metadata
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidenceScore?: number;

  // Listing page patterns
  @Column({ type: 'jsonb', nullable: true })
  listingSelectors?: Record<string, any>;

  // Product page patterns
  @Column({ type: 'jsonb', nullable: true })
  productSelectors?: Record<string, any>;

  // Page classification rules
  @Column({ type: 'jsonb', nullable: true })
  pageClassificationRules?: Record<string, any>;

  // Performance tracking
  @Column({ type: 'int', default: 0 })
  successCount: number;

  @Column({ type: 'int', default: 0 })
  failureCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt?: Date;

  // Metadata
  @Column({ type: 'text', array: true, nullable: true })
  learnedFromUrls?: string[];

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => SiteConfig, (siteConfig) => siteConfig.llmRecipes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'site_config_id' })
  siteConfig: SiteConfig;

  @OneToMany(() => CrawlRun, (crawlRun) => crawlRun.llmRecipe)
  crawlRuns: CrawlRun[];
}
