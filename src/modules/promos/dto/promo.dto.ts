import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PromoDiscountType, PromoStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreatePromoDto {
  @ApiProperty({ example: 'WELCOME20' })
  @IsString()
  @Length(2, 40)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PromoDiscountType })
  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue!: number;

  @ApiPropertyOptional({ description: 'Restrict to a specific category' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minOrderValue?: number;

  @ApiPropertyOptional({ description: '0 means unlimited' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxUses?: number;

  @ApiProperty()
  @IsDateString()
  validFrom!: string;

  @ApiProperty()
  @IsDateString()
  validUntil!: string;

  @ApiPropertyOptional({ enum: PromoStatus, default: PromoStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PromoStatus)
  status?: PromoStatus;
}

export class UpdatePromoDto extends PartialType(CreatePromoDto) {}

export class ValidatePromoDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  orderAmount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;
}
