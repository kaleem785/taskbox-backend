import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ApplicantExperience } from '../../../prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ example: '+923011112222' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  availability?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Area IDs covered (coverage filter)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  areaIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Initial zone IDs to assign' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds?: string[];

  @ApiPropertyOptional({ enum: ['Standard', 'Premium', 'Elite'] })
  @IsOptional()
  @IsString()
  @IsIn(['Standard', 'Premium', 'Elite'])
  tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhotoKey?: string;

  @ApiPropertyOptional({ description: 'CNIC number' })
  @IsOptional()
  @IsString()
  cnic?: string;

  @ApiPropertyOptional({ example: '+923011112222' })
  @IsOptional()
  @IsString()
  whatsapp?: string;

  @ApiPropertyOptional({ enum: ['Male', 'Female'] })
  @IsOptional()
  @IsString()
  @IsIn(['Male', 'Female'])
  gender?: string;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date)' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: ApplicantExperience })
  @IsOptional()
  @IsEnum(ApplicantExperience)
  experience?: ApplicantExperience;
}

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  rating?: number;
}

export class ToggleAvailabilityDto {
  @ApiProperty()
  @IsBoolean()
  availability!: boolean;
}

export class AssignZonesDto {
  @ApiPropertyOptional({ type: [String], description: 'Area IDs covered (coverage filter)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  areaIds?: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds!: string[];
}

export class UpdatePartnerDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileKey?: string;
}
