import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class SubmitCommissionDto {
  @ApiProperty({ example: 'JazzCash' })
  @IsString()
  paymentMethod!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  paymentRef!: string;

  @ApiProperty({ description: 'R2 key of uploaded screenshot' })
  @IsString()
  screenshotKey!: string;
}

export class RejectCommissionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 1000)
  reason!: string;
}

export class CommissionQueryDto {
  @ApiPropertyOptional({ enum: CommissionStatus })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Week start (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  week?: string;
}

export class UpdateSettingsDto extends PartialType(class _ {}) {
  @ApiPropertyOptional({
    description: 'Mapping of categoryId or category slug → rate %',
  })
  @IsOptional()
  @IsObject()
  categoryRates?: Record<string, number>;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultRatePercent?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  deadlineDayOfWeek?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  deadlineHourLocal?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 59 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(59)
  deadlineMinuteLocal?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warning1Hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  warning2Hours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  suspensionHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoSuspensionEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  penaltyFineFixed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  penaltyPercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxFineCap?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifyPush?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  notifySms?: boolean;
}

export class GenerateWeekDto {
  @ApiProperty({ description: 'Monday of the week to generate (YYYY-MM-DD)' })
  @IsString()
  weekStart!: string;
}
