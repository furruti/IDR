import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');

  const corsOriginString = config.get<string>('CORS_ORIGIN') ?? 'http://localhost:3000';
  const corsOrigins = corsOriginString.split(',').map(origin => origin.trim());
  app.enableCors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  await app.listen(Number(config.get<string>('PORT') ?? 3002));
}
void bootstrap();
