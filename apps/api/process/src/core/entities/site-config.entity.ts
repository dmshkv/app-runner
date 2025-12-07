import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CrawlRun } from './crawl-run.entity';
import { LlmRecipe } from './llm-recipe.entity';
import { Product } from './product.entity';

@Entity('site_configs')
@Index(['domain'], { unique: true })
export class SiteConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Site identification
  @Column({ type: 'varchar', length: 255 })
  @Index()
  domain: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // Crawl configuration
  @Column({ type: 'text', array: true })
  seeds: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  allowedPathPatterns: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  disallowedPathPatterns: string[];

  // Rate limiting & politeness
  @Column({ type: 'int', default: 1000 })
  throttleMs: number;

  @Column({ type: 'int', default: 3 })
  maxDepth: number;

  @Column({ type: 'int', default: 100 })
  maxPagesPerRun: number;

  // Product type configuration
  @Column({ type: 'varchar', length: 100, default: 'generic' })
  @Index()
  productType: string;

  @Column({ type: 'jsonb', nullable: true })
  productSchema?: Record<string, any>;

  // Status and metadata
  @Column({ type: 'boolean', default: true })
  @Index()
  isActive: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastCrawledAt?: Date;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  // Timestamps
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => CrawlRun, (crawlRun) => crawlRun.siteConfig)
  crawlRuns: CrawlRun[];

  @OneToMany(() => LlmRecipe, (recipe) => recipe.siteConfig)
  llmRecipes: LlmRecipe[];

  @OneToMany(() => Product, (product) => product.siteConfig)
  products: Product[];
}
