import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();
    const { method, url, body } = req;
    const start = Date.now();

    this.logger.log(`→ ${method} ${url} | body: ${JSON.stringify(body)}`);

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          const ms = Date.now() - start;
          this.logger.log(
            `← ${method} ${url} ${res.statusCode} | ${ms}ms | body: ${JSON.stringify(responseBody)}`,
          );
        },
        error: (err) => {
          const ms = Date.now() - start;
          this.logger.error(
            `← ${method} ${url} ${err.status ?? 500} | ${ms}ms | error: ${err.message}`,
          );
        },
      }),
    );
  }
}
