import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ...(process.env.DATABASE_URL ? [
      TypeOrmModule.forRootAsync({
        useFactory: () => ({
          type: 'postgres',
          url: process.env.DATABASE_URL,
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV === 'development' ? true : false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        }),
      }),
    ] : []),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
