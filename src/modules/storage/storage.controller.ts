import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { PresignedUploadDto } from './dto/presigned-upload.dto';
import { StorageService } from './storage.service';

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
}
