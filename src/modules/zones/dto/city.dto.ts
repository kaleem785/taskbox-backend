import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class CreateCityDto {
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
