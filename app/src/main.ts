import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // /vk/verify is called by the VK-hosted game from another origin. The request is
  // authenticated with VK's signed launch parameters, so browser credentials are
  // neither needed nor accepted.
  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Log every incoming request at Express level (before NestJS routing)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    console.log(
      `[RAW] → ${req.method} ${req.url} | content-type: ${req.headers['content-type'] ?? 'none'}`,
    );
    next();
  });

  // Accept raw text body so we can parse the custom key=value&... format
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (
      req.headers['content-type']?.includes('text/plain') ||
      req.headers['content-type']?.includes(
        'application/x-www-form-urlencoded',
      ) ||
      !req.headers['content-type']
    ) {
      let data = '';
      req.on('data', (chunk: Buffer) => {
        data += chunk.toString('utf-8');
      });
      req.on('end', () => {
        req.body = data;
        next();
      });
    } else {
      next();
    }
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
