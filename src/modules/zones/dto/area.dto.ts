import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

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
