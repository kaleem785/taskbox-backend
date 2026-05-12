import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

export interface ResponseEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

const RAW_RESPONSE = Symbol('rawResponse');

/**
 * Wrap controller responses in `{ data, meta? }`.
 * If the controller already returns `{ data, meta }`, it is passed through unchanged.
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, ResponseEnvelope<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ResponseEnvelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (payload && typeof payload === 'object' && 'data' in payload) {
          return payload as unknown as ResponseEnvelope<T>;
        }
        return { data: payload };
      }),
    );
  }

  static raw<T>(value: T): T & { [RAW_RESPONSE]: true } {
    return value as T & { [RAW_RESPONSE]: true };
  }
}
