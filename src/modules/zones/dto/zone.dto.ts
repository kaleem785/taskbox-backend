import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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
