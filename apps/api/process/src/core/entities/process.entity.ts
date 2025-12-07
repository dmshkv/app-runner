import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Url } from './url.entity';

export enum ProcessStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('processes')
@Index(['status', 'createdAt'])
export class Process {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ProcessStatus,
    default: ProcessStatus.INITIATED,
  })
  @Index()
  status: ProcessStatus;

  @Column({ type: 'int', default: 0 })
  totalUrls: number;

  @Column({ type: 'int', default: 0 })
  completedUrls: number;

  @Column({ type: 'int', default: 0 })
  failedUrls: number;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Url, (url) => url.process)
  urls: Url[];
}
