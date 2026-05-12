import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

export type UploadPurpose =
  | 'verification.cnicFront'
  | 'verification.cnicBack'
  | 'verification.selfie'
  | 'verification.certificate'
  | 'verification.experience'
  | 'partner.profilePhoto'
  | 'commission.proof';

const PURPOSE_RULES: Record<
  UploadPurpose,
  { prefix: (id: string) => string; mimeAllowlist: string[]; maxBytes: number }
> = {
  'verification.cnicFront': {
    prefix: (id) => `verification/${id}/cnic-front`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 5 * 1024 * 1024,
  },
  'verification.cnicBack': {
    prefix: (id) => `verification/${id}/cnic-back`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 5 * 1024 * 1024,
  },
  'verification.selfie': {
    prefix: (id) => `verification/${id}/selfie`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
  'verification.certificate': {
    prefix: (id) => `verification/${id}/certificate`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
  },
  'verification.experience': {
    prefix: (id) => `verification/${id}/experience`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
  },
  'partner.profilePhoto': {
    prefix: (id) => `partner/${id}/profile`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 3 * 1024 * 1024,
  },
  'commission.proof': {
    prefix: (id) => `commission/${id}/proof`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp'],
    maxBytes: 5 * 1024 * 1024,
  },
};

const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('r2.endpoint');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    this.bucket = this.config.get<string>('r2.bucket') ?? '';

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.warn(
        'R2 not fully configured — presigned URLs will return 503. Set R2_* env vars to enable.',
      );
      this.client = null;
    } else {
      this.client = new S3Client({
        region: this.config.get<string>('r2.region') ?? 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
    }
  }

  async getPresignedUploadUrl(input: {
    purpose: UploadPurpose;
    entityId: string;
    mimeType: string;
    size: number;
    filename?: string;
  }): Promise<{ uploadUrl: string; key: string; expiresAt: string; maxSize: number }> {
    const rule = PURPOSE_RULES[input.purpose];
    if (!rule) throw new BadRequestException(`Unknown purpose: ${input.purpose}`);
    if (!rule.mimeAllowlist.includes(input.mimeType)) {
      throw new BadRequestException(
        `mimeType not allowed for ${input.purpose}: ${input.mimeType}`,
      );
    }
    if (input.size > rule.maxBytes) {
      throw new BadRequestException(
        `File exceeds max size for ${input.purpose}: ${rule.maxBytes} bytes`,
      );
    }

    if (!this.client) {
      throw new InternalServerErrorException('Object storage not configured');
    }

    const ext = guessExtension(input.mimeType, input.filename);
    const key = `${rule.prefix(input.entityId)}-${randomUUID()}${ext}`;

    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: input.mimeType,
        ContentLength: input.size,
      }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );

    return {
      uploadUrl: url,
      key,
      expiresAt: new Date(Date.now() + UPLOAD_TTL_SECONDS * 1000).toISOString(),
      maxSize: rule.maxBytes,
    };
  }

  async getPresignedDownloadUrl(key: string): Promise<{ url: string; expiresAt: string }> {
    if (!this.client) {
      throw new InternalServerErrorException('Object storage not configured');
    }
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + DOWNLOAD_TTL_SECONDS * 1000).toISOString(),
    };
  }
}

function guessExtension(mime: string, filename?: string): string {
  if (filename) {
    const dot = filename.lastIndexOf('.');
    if (dot >= 0 && dot < filename.length - 1) return filename.slice(dot).toLowerCase();
  }
  switch (mime) {
    case 'image/jpeg': return '.jpg';
    case 'image/png': return '.png';
    case 'image/webp': return '.webp';
    case 'application/pdf': return '.pdf';
    default: return '';
  }
}
