import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @ApiProperty()
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ example: 'ac-services' })
  @IsString()
  @Matches(SLUG_RX, { message: 'slug must be lowercase kebab-case' })
  slug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Public URL of the category illustration (set via POST /uploads/category-image).',
  })
  @IsOptional()
  @IsString()
  imageUrl?: string;

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
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}
