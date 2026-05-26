import {
  BadRequestException,
  Body,
  Controller,
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
  CATALOG_IMAGE_KINDS,
  CATALOG_IMAGE_MAX_BYTES,
  CATALOG_IMAGE_MIME_ALLOWLIST,
  CatalogImageKind,
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
