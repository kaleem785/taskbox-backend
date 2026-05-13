import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BookingStatus, CancelReason, PaymentStatus } from '../../../prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  customerId!: string;

  @ApiProperty()
  @IsString()
  customerAddressId!: string;

  @ApiProperty()
  @IsString()
  serviceId!: string;

  @ApiProperty({ example: '2026-05-20' })
  @IsDateString()
  scheduledDate!: string;

  @ApiProperty({ example: '10:30 AM' })
  @IsString()
  @Length(1, 20)
  scheduledTime!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateBookingDto extends PartialType(CreateBookingDto) {}

export class ReassignBookingDto {
  @ApiProperty()
  @IsString()
  partnerId!: string;
}

export class CancelBookingDto {
  @ApiProperty({ enum: CancelReason })
  @IsEnum(CancelReason)
  reason!: CancelReason;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  detail?: string;
}

export class TransitionStatusDto {
  @ApiProperty({ enum: BookingStatus })
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus })
  @IsEnum(PaymentStatus)
  paymentStatus!: PaymentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}
