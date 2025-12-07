import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Process } from './process.entity';

export enum UrlStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('urls')
@Index(['status', 'createdAt'])
@Index(['processId', 'status'])
export class Url {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  processId: string;

  @ManyToOne(() => Process, (process) => process.urls, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'processId' })
  process: Process;

  @Column({ type: 'text' })
  @Index()
  url: string;

  @Column({
    type: 'enum',
    enum: UrlStatus,
    default: UrlStatus.PENDING,
  })
  @Index()
  status: UrlStatus;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'jsonb', nullable: true })
  selectors?: Record<string, string>;

  @Column({ type: 'jsonb', nullable: true })
  options?: {
    waitForSelector?: string;
    timeout?: number;
    extractFullHtml?: boolean;
    screenshot?: boolean;
    waitForNetworkIdle?: boolean;
  };

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true })
  processedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
