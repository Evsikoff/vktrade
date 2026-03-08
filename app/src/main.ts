import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { LoggingInterceptor } from './logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Accept raw text body so we can parse the custom key=value&... format
  app.use((req, res, next) => {
    if (req.headers['content-type']?.includes('text/plain') ||
        req.headers['content-type']?.includes('application/x-www-form-urlencoded') ||
        !req.headers['content-type']) {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
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
bootstrap();
