import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DocumentType } from '../../../prisma/client';

/**
 * Request body for the public scoped presigned-upload route. The server derives
 * the storage `entityId` from the upload token's `applicantId` (never the
 * client) and maps `type` to the corresponding `verification.*` purpose — so a
 * token can only ever write to its own applicant's prefix.
 */
export class AppPresignedUploadDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type!: DocumentType;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  size!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  filename?: string;
}

export class AppUpdateDocumentDto {
  @ApiProperty({ description: 'Storage key returned after the R2 PUT' })
  @IsString()
  fileKey!: string;
}
