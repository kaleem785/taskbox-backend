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
  | 'partner.cnicFront'
  | 'partner.cnicBack'
  | 'partner.certificate'
  | 'commission.proof';

/** Catalog image kinds accepted by POST /uploads/catalog-image. `icon` kinds are
 *  resized to a square transparent PNG (suitable for the customer icon grid).
 *  `hero` kinds are resized fit-inside while preserving aspect + original
 *  format (suitable for service hero photos and variant/package cards). */
export type CatalogImageKind =
  | 'category'
  | 'service-icon'
  | 'service-image'
  | 'variant'
  | 'package';

export const CATALOG_IMAGE_KINDS: readonly CatalogImageKind[] = [
  'category',
  'service-icon',
  'service-image',
  'variant',
  'package',
];

/** Square pixel size icon-mode catalog images are resized to before storage. */
export const CATALOG_ICON_DIMENSION = 512;
/** Max long-edge pixel size hero-mode catalog images are resized to. */
export const CATALOG_HERO_MAX_DIMENSION = 1600;
/** Hard cap on incoming catalog image bytes. */
export const CATALOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
/** MIME types accepted by the catalog-image upload endpoint. */
export const CATALOG_IMAGE_MIME_ALLOWLIST = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const;

const CATALOG_KIND_RULES: Record<
  CatalogImageKind,
  { prefix: string; mode: 'icon' | 'hero' }
> = {
  category: { prefix: 'catalog/categories', mode: 'icon' },
  'service-icon': { prefix: 'catalog/services/icons', mode: 'icon' },
  'service-image': { prefix: 'catalog/services/images', mode: 'hero' },
  variant: { prefix: 'catalog/variants', mode: 'hero' },
  package: { prefix: 'catalog/packages', mode: 'hero' },
};

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
  'partner.cnicFront': {
    prefix: (id) => `partner/${id}/cnic-front`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 5 * 1024 * 1024,
  },
  'partner.cnicBack': {
    prefix: (id) => `partner/${id}/cnic-back`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 5 * 1024 * 1024,
  },
  'partner.certificate': {
    prefix: (id) => `partner/${id}/certificate`,
    mimeAllowlist: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    maxBytes: 10 * 1024 * 1024,
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
   * Normalizes an admin-uploaded catalog image and PUTs it directly to R2.
   * Returns the storage key plus the public URL the row should persist
   * (always `${publicBaseUrl}/${key}`, no signing).
   *
   * - `icon` kinds (category, service-icon) → 512x512 transparent PNG.
   * - `hero` kinds (service-image, variant, package) → fit-inside 1600px on
   *   the long edge, preserves aspect ratio and original format (PNG/JPEG/WebP).
   */
  async uploadCatalogImage(input: {
    buffer: Buffer;
    mimeType: string;
    kind: CatalogImageKind;
  }): Promise<{ key: string; url: string }> {
    if (!(CATALOG_IMAGE_MIME_ALLOWLIST as readonly string[]).includes(input.mimeType)) {
      throw new BadRequestException(
        `mimeType not allowed for catalog upload: ${input.mimeType}`,
      );
    }
    if (input.buffer.length > CATALOG_IMAGE_MAX_BYTES) {
      throw new BadRequestException(
        `File exceeds max size: ${CATALOG_IMAGE_MAX_BYTES} bytes`,
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

    const rule = CATALOG_KIND_RULES[input.kind];
    if (!rule) throw new BadRequestException(`Unknown kind: ${input.kind}`);

    let body: Buffer;
    let outputMime: string;
    let ext: string;
    try {
      if (rule.mode === 'icon') {
        body = await sharp(input.buffer)
          .resize(CATALOG_ICON_DIMENSION, CATALOG_ICON_DIMENSION, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .png({ compressionLevel: 9 })
          .toBuffer();
        outputMime = 'image/png';
        ext = '.png';
      } else {
        body = await sharp(input.buffer)
          .resize(CATALOG_HERO_MAX_DIMENSION, CATALOG_HERO_MAX_DIMENSION, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .toBuffer();
        outputMime = input.mimeType;
        ext = guessExtension(input.mimeType);
      }
    } catch (err) {
      this.logger.warn(`sharp failed to process image: ${(err as Error).message}`);
      throw new BadRequestException('Could not process image (corrupt or unsupported).');
    }

    const key = `${rule.prefix}/${randomUUID()}${ext}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: outputMime,
        ContentLength: body.length,
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
