import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
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

  @ApiPropertyOptional({ type: [String], description: 'Initial zone IDs to assign' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds?: string[];

  @ApiPropertyOptional({ enum: ['Standard', 'Premium', 'Elite'] })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  profilePhotoKey?: string;
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
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  zoneIds!: string[];
}
