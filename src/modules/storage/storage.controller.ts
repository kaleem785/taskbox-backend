import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
// Registers `Express.Multer.File` on the global Express namespace.
import 'multer';

import { Role } from '../../prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import {
  DeletePartnerFileDto,
  PartnerFileUploadDto,
} from './dto/partner-file-upload.dto';
import {
  CATALOG_IMAGE_KINDS,
  CATALOG_IMAGE_MAX_BYTES,
  CATALOG_IMAGE_MIME_ALLOWLIST,
  CatalogImageKind,
  PARTNER_FILE_MAX_BYTES,
  StorageService,
} from './storage.service';

@ApiBearerAuth()
@ApiTags('uploads')
@Controller('uploads')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('presigned-url')
  @ApiOperation({
    summary: 'Request a presigned PUT URL for direct browser upload to R2',
  })
  presigned(@Body() dto: PresignedUploadDto) {
    return this.storage.getPresignedUploadUrl({
      purpose: dto.purpose,
      entityId: dto.entityId,
      mimeType: dto.mimeType,
      size: dto.size,
      filename: dto.filename,
    });
  }

  /**
   * Server-side partner file upload (profile photo / CNIC front-back /
   * certificate). The browser POSTs the raw file here and the API streams it to
   * R2 — no browser→R2 direct PUT, so no bucket CORS is required. Returns the
   * storage key to persist on the partner / PartnerDocument row.
   *
   * Admin-only. Send `multipart/form-data` with a `file` part plus `purpose`
   * and `entityId` fields.
   */
  @Roles(Role.ADMIN)
  @Post('partner-file')
  @ApiOperation({
    summary:
      'Upload a partner file (profile / CNIC / certificate) server-side to R2; returns the storage key',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose', 'entityId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string' },
        entityId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: PARTNER_FILE_MAX_BYTES } }),
  )
  async uploadPartnerFile(
    @UploadedFile(new ParseFilePipeBuilder().build({ fileIsRequired: true }))
    file: Express.Multer.File,
    @Body() body: PartnerFileUploadDto,
  ) {
    return this.storage.uploadPartnerFileDirect({
      buffer: file.buffer,
      mimeType: file.mimetype,
      size: file.size,
      purpose: body.purpose,
      entityId: body.entityId,
      filename: file.originalname,
    });
  }

  /**
   * Delete a partner file from R2 by storage key (e.g. when an admin removes a
   * picked-but-not-yet-saved upload). Admin-only; scoped to partner/* keys.
   */
  @Roles(Role.ADMIN)
  @Delete('partner-file')
  @ApiOperation({ summary: 'Delete a partner file from R2 by storage key' })
  async deletePartnerFile(@Body() body: DeletePartnerFileDto) {
    await this.storage.deletePartnerFile(body.key);
    return { deleted: true };
  }

  @Roles(Role.ADMIN, Role.EXAMINER)
  @Get('presigned-download/*key')
  @ApiOperation({ summary: 'Get a short-lived signed GET URL for a stored object' })
  download(@Param('key') key: string | string[]) {
    const resolved = Array.isArray(key) ? key.join('/') : key;
    return this.storage.getPresignedDownloadUrl(resolved);
  }

  /**
   * Multipart upload for any catalog image: Category icon, Service icon,
   * Service hero, Variant image, or Package image. Sharp normalizes the
   * upload (square-transparent PNG for `icon` kinds; fit-inside resize for
   * `hero` kinds) and PUTs it to R2. Returns the permanent public URL the
   * admin can persist on the corresponding row (`Category.iconUrl`,
   * `Service.iconUrl` / `Service.imageUrl`, `ServiceVariant.imageUrl`,
   * `Package.imageUrl`).
   *
   * Admin-only: mutates bucket contents. Send `multipart/form-data` with a
   * `file` part; `kind` is a required query parameter.
   */
  @Roles(Role.ADMIN)
  @Post('catalog-image')
  @ApiOperation({
    summary:
      'Upload + normalize a catalog image (category / service-icon / service-image / variant / package); returns the public URL',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'kind',
    required: true,
    enum: CATALOG_IMAGE_KINDS as unknown as string[],
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: CATALOG_IMAGE_MAX_BYTES } }),
  )
  async uploadCatalogImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: new RegExp(
            `^(${CATALOG_IMAGE_MIME_ALLOWLIST.join('|').replace(/\//g, '\\/')})$`,
          ),
        })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Query('kind') kind: string,
  ) {
    if (!CATALOG_IMAGE_KINDS.includes(kind as CatalogImageKind)) {
      throw new BadRequestException(
        `kind must be one of: ${CATALOG_IMAGE_KINDS.join(', ')}`,
      );
    }
    return this.storage.uploadCatalogImage({
      buffer: file.buffer,
      mimeType: file.mimetype,
      kind: kind as CatalogImageKind,
    });
  }
}
