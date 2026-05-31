import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApplicantExperience, ApplicantStatus, DocumentStatus, DocumentType, PartnerTier } from '../../../prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateApplicantDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty()
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cnic?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: ApplicantExperience })
  @IsOptional()
  @IsEnum(ApplicantExperience)
  experience?: ApplicantExperience;

  @ApiPropertyOptional({ example: 'Partner App (Android)' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ type: [String], description: 'Desired area coverage' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  areaIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Desired zone coverage' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds?: string[];
}

export class UpdateApplicantDto extends PartialType(CreateApplicantDto) {}

export class UpdateDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileKey?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  feedback?: string;
}

export class RequestChangesDto {
  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  feedback!: string;
}

export class ScheduleTestDto {
  @ApiProperty()
  @IsString()
  scheduledAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  venueName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  examinerUserId?: string;
}

export class ScoreTestDto {
  @ApiProperty()
  @IsBoolean()
  attended!: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  scoreSafety?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  scoreTools?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  scorePractical?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  scoreCustomer?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(15)
  scoreDocs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveApplicantDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Area coverage; defaults to the applicant\'s submitted areas',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  areaIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Zone coverage; defaults to the applicant\'s submitted zones',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds?: string[];

  @ApiPropertyOptional({ enum: PartnerTier })
  @IsOptional()
  @IsEnum(PartnerTier)
  tier?: PartnerTier;
}

export class RejectApplicantDto {
  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class ApplicantQueryDto {
  @ApiPropertyOptional({ enum: ApplicantStatus })
  @IsOptional()
  @IsEnum(ApplicantStatus)
  status?: ApplicantStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;
}

export class DocumentTypeParamDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type!: DocumentType;
}
