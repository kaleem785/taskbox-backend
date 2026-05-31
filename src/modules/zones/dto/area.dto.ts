import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Query params for `GET /areas`. All optional, so callers that omit `page`/
 * `limit` still get the plain (unpaginated) array — see ZonesService.listAreas.
 */
export class AreaQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cityId?: string;

  @ApiPropertyOptional({ description: 'Filter by name (case-insensitive contains)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Defaults to true; pass "false" to include inactive' })
  @IsOptional()
  @IsString()
  activeOnly?: string;

  @ApiPropertyOptional({ minimum: 1, description: 'Opt into pagination together with limit' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, description: 'Opt into pagination together with page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class CreateAreaDto {
  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiProperty({ example: 'DHA' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateAreaDto extends PartialType(CreateAreaDto) {}
