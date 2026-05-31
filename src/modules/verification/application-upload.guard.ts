import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export const APPLICATION_UPLOAD_SCOPE = 'application-upload';

export interface ApplicationUploadPayload {
  applicantId: string;
  scope: typeof APPLICATION_UPLOAD_SCOPE;
}

/**
 * Guards the public scoped-upload routes. Verifies the short-lived JWT issued by
 * `POST /partners/apply` (signed with the dedicated upload secret), checks the
 * scope, and asserts the token's `applicantId` matches the `:id` route param —
 * so a token can only act on its own applicant.
 */
@Injectable()
export class ApplicationUploadGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing upload token');
    }
    const token = header.slice('Bearer '.length).trim();

    let payload: ApplicationUploadPayload;
    try {
      payload = await this.jwt.verifyAsync<ApplicationUploadPayload>(token, {
        secret: this.config.get<string>('applicationUpload.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired upload token');
    }

    if (payload.scope !== APPLICATION_UPLOAD_SCOPE) {
      throw new UnauthorizedException('Token is not scoped for uploads');
    }
    if (payload.applicantId !== req.params.id) {
      throw new UnauthorizedException('Token does not match this applicant');
    }

    (req as Request & { uploadPayload?: ApplicationUploadPayload }).uploadPayload =
      payload;
    return true;
  }
}
