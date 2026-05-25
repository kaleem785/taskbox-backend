import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateHomeFeatureDto {
  @ApiProperty()
  @IsString()
  serviceId!: string;

  @ApiProperty({ description: 'FK to HomeSection.id' })
  @IsString()
  sectionId!: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  validUntil?: string;
}

/** Update omits serviceId/sectionId — those define identity and can't move. */
export class UpdateHomeFeatureDto extends PartialType(
  OmitType(CreateHomeFeatureDto, ['serviceId', 'sectionId'] as const),
) {}

export class ReorderHomeFeaturesDto {
  @ApiProperty({ description: 'FK to HomeSection.id whose features are being reordered.' })
  @IsString()
  sectionId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  orderedIds!: string[];
}
