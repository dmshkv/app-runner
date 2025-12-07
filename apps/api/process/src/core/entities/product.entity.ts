import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { CrawlRun } from './crawl-run.entity';
import { SiteConfig } from './site-config.entity';
import { PageTask } from './page-task.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  crawlRunId: string;

  @Column({ type: 'uuid' })
  @Index()
  siteConfigId: string;

  @Column({ type: 'uuid', nullable: true })
  pageTaskId?: string;

  // Source information
  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  externalId?: string;

  // Generic product fields (common across all product types)
  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Pricing
  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  @Index()
  price?: number;

  @Column({ type: 'varchar', length: 10, default: 'CAD' })
  currency: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  priceQualifier?: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  originalPrice?: number;

  // Categorization
  @Column({ type: 'varchar', length: 100 })
  @Index()
  productType: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  category?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subcategory?: string;

  // Location
  @Column({ type: 'varchar', length: 255, nullable: true })
  @Index()
  city?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  province?: string;

  @Column({ type: 'varchar', length: 10, default: 'CA' })
  country: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postalCode?: string;

  // Generic attributes (extensible)
  @Column({ type: 'jsonb', default: {} })
  attributes: Record<string, any>;

  // Images and media
  @Column({ type: 'text', array: true, nullable: true })
  images?: string[];

  @Column({ type: 'text', nullable: true })
  primaryImageUrl?: string;

  // Extraction metadata
  @Column({ type: 'varchar', length: 50, nullable: true })
  extractionMethod?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  extractionConfidence?: number;

  // Verification and quality
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  @Index()
  verificationStatus?: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  qualityScore?: number;

  // Deduplication
  @Column({ type: 'varchar', length: 64, nullable: true })
  @Index()
  contentHash?: string;

  @Column({ type: 'boolean', default: false })
  @Index()
  isDuplicate: boolean;

  @Column({ type: 'uuid', nullable: true })
  duplicateOfId?: string;

  // Raw data
  @Column({ type: 'text', nullable: true })
  rawHtml?: string;

  @Column({ type: 'jsonb', nullable: true })
  rawData?: Record<string, any>;

  // Metadata
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  firstSeenAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => CrawlRun, (crawlRun) => crawlRun.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'crawl_run_id' })
  crawlRun: CrawlRun;

  @ManyToOne(() => SiteConfig, (siteConfig) => siteConfig.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'site_config_id' })
  siteConfig: SiteConfig;

  @ManyToOne(() => PageTask, (pageTask) => pageTask.products, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'page_task_id' })
  pageTask?: PageTask;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'duplicate_of_id' })
  duplicateOf?: Product;
}
