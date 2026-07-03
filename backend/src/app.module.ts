import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CctvModule } from './cctv/cctv.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    HealthModule,
    CctvModule,
  ],
})
export class AppModule {}
