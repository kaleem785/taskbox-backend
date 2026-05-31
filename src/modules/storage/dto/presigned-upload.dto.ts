import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const UPLOAD_PURPOSES = [
  'verification.cnicFront',
  'verification.cnicBack',
  'verification.selfie',
  'verification.certificate',
  'verification.experience',
  'partner.profilePhoto',
  'partner.cnicFront',
  'partner.cnicBack',
  'partner.certificate',
  'commission.proof',
] as const;
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number];

export class PresignedUploadDto {
  @ApiProperty({ enum: UPLOAD_PURPOSES })
  @IsIn(UPLOAD_PURPOSES)
  purpose!: UploadPurpose;

  @ApiProperty({
    description: 'The id of the related entity (applicant, partner, commission)',
  })
  @IsString()
  entityId!: string;

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
