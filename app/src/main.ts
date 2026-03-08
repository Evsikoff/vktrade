import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
