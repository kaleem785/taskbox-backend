import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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
}

export class UpdateZoneDto extends PartialType(CreateZoneDto) {}
