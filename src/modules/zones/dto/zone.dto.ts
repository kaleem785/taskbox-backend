import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateZoneDto {
  @ApiProperty()
  @IsString()
  cityId!: string;

  @ApiProperty({ example: 'Defence (DHA)' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional({ example: '#FF6F00' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    type: [String],
    description: 'Initial area names to seed under this zone',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  areas?: string[];
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}

export class CreateZoneAreaDto {
  @ApiProperty({ example: 'DHA Phase 5' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  displayOrder?: number;
}
