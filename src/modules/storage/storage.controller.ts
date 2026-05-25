import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseFilePipeBuilder,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
// Registers `Express.Multer.File` on the global Express namespace.
import 'multer';

import { Role } from '../../prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import {
  CATEGORY_IMAGE_MAX_BYTES,
  CATEGORY_IMAGE_MIME_ALLOWLIST,
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
   * Multipart upload for category illustrations. The backend resizes to a square
   * 512x512 transparent PNG with sharp, then PUTs directly to R2. Returns the
   * permanent public URL the admin can persist on Category.imageUrl.
   *
   * Admin-only: this endpoint mutates bucket contents. Browsers must send
   * `multipart/form-data` with a `file` part (the image) and a `categoryId`
   * text part (used to namespace the object key under category/<id>/...).
   */
  @Roles(Role.ADMIN)
  @Post('category-image')
  @ApiOperation({
    summary: 'Upload + resize a category illustration; returns the public URL',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'categoryId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        categoryId: { type: 'string' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: CATEGORY_IMAGE_MAX_BYTES } }),
  )
  async uploadCategoryImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({
          fileType: new RegExp(
            `^(${CATEGORY_IMAGE_MIME_ALLOWLIST.join('|').replace(/\//g, '\\/')})$`,
          ),
        })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
    @Body('categoryId') categoryId: string,
  ) {
    if (!categoryId || typeof categoryId !== 'string') {
      throw new BadRequestException('categoryId is required');
    }
    return this.storage.uploadResizedImage({
      buffer: file.buffer,
      mimeType: file.mimetype,
      entityId: categoryId,
      purpose: 'category.image',
    });
  }
}
