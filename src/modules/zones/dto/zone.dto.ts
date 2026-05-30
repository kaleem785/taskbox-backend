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
 * Query params for `GET /zones`. All optional, so callers that omit `page`/
 * `limit` still get the plain (unpaginated) array — see ZonesService.listZones.
 * Keeps the existing single `areaId` / comma-separated `areaIds` selectors.
 */
export class ZoneQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  areaId?: string;

  @ApiPropertyOptional({ description: 'Comma-separated area IDs (batch load)' })
  @IsOptional()
  @IsString()
  areaIds?: string;

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

export class CreateZoneDto {
  @ApiProperty()
  @IsString()
  areaId!: string;

  @ApiProperty({ example: 'DHA Phase 5' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
