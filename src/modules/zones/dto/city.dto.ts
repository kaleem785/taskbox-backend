import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCityDto {
  @ApiProperty({ example: 'lahore' })
  @IsString()
  @Matches(SLUG_RX)
  slug!: string;

  @ApiProperty({ example: 'Lahore' })
  @IsString()
  @Length(1, 80)
  name!: string;

  @ApiProperty({ example: 'Punjab' })
  @IsString()
  @Length(1, 80)
  province!: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCityDto extends PartialType(CreateCityDto) {}
