import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '../../prisma/client';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  requestId?: string;
  /** The conflicting field for a unique-constraint (409) error, when known. */
  field?: string;
}

/** Unique fields we surface a friendly, field-named message for. */
const UNIQUE_FIELD_LABELS: Record<string, string> = {
  phone: 'phone number',
  email: 'email address',
  cnic: 'CNIC',
  whatsapp: 'WhatsApp number',
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    const { status, message, error, field } = this.normalize(exception);

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId: request.id,
      ...(field ? { field } : {}),
    };

    if (status >= 500) {
      this.logger.error({ err: exception, path: request.url }, 'Unhandled exception');
    }

    response.status(status).json(body);
  }

  private normalize(exception: unknown): {
    status: number;
    message: string | string[];
    error: string;
    field?: string;
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const status = exception.getStatus();
      if (typeof response === 'string') {
        return { status, message: response, error: exception.name };
      }
      const obj = response as { message?: string | string[]; error?: string };
      return {
        status,
        message: obj.message ?? exception.message,
        error: obj.error ?? exception.name,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaError(exception);
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Invalid query parameters',
        error: 'PrismaValidationError',
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    error: string;
    field?: string;
  } {
    switch (err.code) {
      case 'P2002': {
        const field = this.resolveUniqueField(err);
        const label = field ? UNIQUE_FIELD_LABELS[field] : undefined;
        return {
          status: HttpStatus.CONFLICT,
          message: label
            ? `A partner with this ${label} already exists.`
            : 'A record with these details already exists.',
          error: 'Conflict',
          ...(field ? { field } : {}),
        };
      }
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          message: 'Record not found',
          error: 'NotFound',
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          message: 'Foreign key constraint failed',
          error: 'BadRequest',
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Database error',
          error: 'PrismaError',
        };
    }
  }

  /**
   * Find the conflicting unique field from a P2002 error across Prisma engines:
   *  - Prisma 7 driver adapter:
   *      meta.driverAdapterError.cause.constraint.fields = ['email']
   *      (constraint name also in cause.originalMessage, e.g. 'partners_email_key')
   *  - Library engine / older: meta.target = ['email'] or 'partners_email_key'
   * Returns the first known unique field referenced, else undefined.
   */
  private resolveUniqueField(
    err: Prisma.PrismaClientKnownRequestError,
  ): string | undefined {
    const known = Object.keys(UNIQUE_FIELD_LABELS);
    const meta = (err.meta ?? {}) as Record<string, unknown>;
    const cause = (meta.driverAdapterError as { cause?: Record<string, unknown> })
      ?.cause;
    const constraintFields = (cause?.constraint as { fields?: string[] })?.fields;

    const candidates: string[] = [
      ...(Array.isArray(constraintFields) ? constraintFields : []),
      ...(Array.isArray(meta.target)
        ? (meta.target as string[])
        : typeof meta.target === 'string'
          ? [meta.target]
          : []),
      ...(typeof cause?.originalMessage === 'string'
        ? [cause.originalMessage as string]
        : []),
    ];

    for (const candidate of candidates) {
      const match = known.find((f) => candidate === f || candidate.includes(f));
      if (match) return match;
    }
    return undefined;
  }
}
