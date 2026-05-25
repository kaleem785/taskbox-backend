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
import sharp from 'sharp';

export type UploadPurpose =
  | 'verification.cnicFront'
  | 'verification.cnicBack'
  | 'verification.selfie'
  | 'verification.certificate'
  | 'verification.experience'
  | 'partner.profilePhoto'
  | 'commission.proof'
  | 'category.image';

/** Square pixel size the backend resizes category illustrations to before storage. */
export const CATEGORY_IMAGE_DIMENSION = 512;
/** Hard cap on incoming category image bytes (the resized PNG is much smaller). */
export const CATEGORY_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** MIME types accepted by the category-image upload endpoint. */
export const CATEGORY_IMAGE_MIME_ALLOWLIST = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

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
  // Note: 'category.image' is uploaded via uploadResizedImage() (multipart through the
  // backend), not via getPresignedUploadUrl. The rule is here only for completeness; the
  // multipart endpoint enforces its own limits via CATEGORY_IMAGE_* constants above.
  'category.image': {
    prefix: (id) => `category/${id}`,
    mimeAllowlist: [...CATEGORY_IMAGE_MIME_ALLOWLIST],
    maxBytes: CATEGORY_IMAGE_MAX_BYTES,
  },
};

const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 5 * 60;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('r2.endpoint');
    const accessKeyId = this.config.get<string>('r2.accessKeyId');
    const secretAccessKey = this.config.get<string>('r2.secretAccessKey');
    this.bucket = this.config.get<string>('r2.bucket') ?? '';
    this.publicBaseUrl = this.config.get<string>('r2.publicBaseUrl') ?? '';

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

  /**
   * Normalizes an arbitrary admin-uploaded image into a fixed 512x512 transparent PNG
   * and PUTs it directly to R2. Returns the storage key plus the public URL the row
   * should persist (always `${publicBaseUrl}/${key}`, no signing).
   *
   * Used for category illustrations today; suitable for any "icon-shaped" image that
   * should look identical across screens. Heavy enough (sharp) that callers should
   * await on a request thread, not a hot loop.
   */
  async uploadResizedImage(input: {
    buffer: Buffer;
    mimeType: string;
    entityId: string;
    purpose: Extract<UploadPurpose, 'category.image'>;
  }): Promise<{ key: string; url: string }> {
    if (!(CATEGORY_IMAGE_MIME_ALLOWLIST as readonly string[]).includes(input.mimeType)) {
      throw new BadRequestException(
        `mimeType not allowed for ${input.purpose}: ${input.mimeType}`,
      );
    }
    if (input.buffer.length > CATEGORY_IMAGE_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds max size for ${input.purpose}: ${CATEGORY_IMAGE_MAX_BYTES} bytes`,
      );
    }
    if (!this.client) {
      throw new InternalServerErrorException('Object storage not configured');
    }
    if (!this.publicBaseUrl) {
      throw new InternalServerErrorException(
        'R2_PUBLIC_BASE_URL not configured — cannot return a usable public URL',
      );
    }

    let resized: Buffer;
    try {
      resized = await sharp(input.buffer)
        .resize(CATEGORY_IMAGE_DIMENSION, CATEGORY_IMAGE_DIMENSION, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } catch (err) {
      this.logger.warn(`sharp failed to process image: ${(err as Error).message}`);
      throw new BadRequestException('Could not process image (corrupt or unsupported).');
    }

    const rule = PURPOSE_RULES[input.purpose];
    const key = `${rule.prefix(input.entityId)}/${randomUUID()}.png`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: resized,
        ContentType: 'image/png',
        ContentLength: resized.length,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return { key, url: `${this.publicBaseUrl}/${key}` };
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
