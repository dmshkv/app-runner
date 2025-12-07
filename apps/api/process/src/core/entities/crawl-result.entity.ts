import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Url } from './url.entity';
import { Process } from './process.entity';

export enum CrawlResultStatus {
  FULL_HTML = 'FULL_HTML',
  TEMPLATE = 'TEMPLATE',
  COMPLETED = 'COMPLETED',
}

@Entity('crawl_results')
@Index(['urlId', 'createdAt'])
@Index(['processId', 'createdAt'])
@Index(['status'])
export class CrawlResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  urlId: string;

  @ManyToOne(() => Url, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'urlId' })
  url: Url;

  @Column({ type: 'uuid' })
  @Index()
  processId: string;

  @ManyToOne(() => Process, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'processId' })
  process: Process;

  @Column({ type: 'text' })
  sourceUrl: string;

  @Column({
    type: 'enum',
    enum: CrawlResultStatus,
    default: CrawlResultStatus.FULL_HTML,
  })
  @Index()
  status: CrawlResultStatus;

  @Column({ type: 'text', nullable: true })
  strategy?: string; // 'FULL_HTML' or 'TEMPLATE'

  @Column({ type: 'text', nullable: true })
  title?: string;

  @Column({ type: 'text', nullable: true })
  html?: string;

  @Column({ type: 'text', nullable: true })
  cleanedHtml?: string; // For FULL_HTML strategy

  @Column({ type: 'jsonb', nullable: true })
  extracted?: Record<string, any>; // For TEMPLATE strategy

  @Column({ type: 'text', nullable: true })
  screenshot?: string; // Base64 encoded

  @Column({ type: 'int', nullable: true })
  statusCode?: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'int', nullable: true })
  htmlLength?: number;

  @Column({ type: 'int', nullable: true })
  cleanedHtmlLength?: number;

  @Column({ type: 'int', nullable: true })
  screenshotSize?: number;

  @Column({ type: 'text', nullable: true })
  requestId?: string;

  @CreateDateColumn()
  createdAt: Date;
}
