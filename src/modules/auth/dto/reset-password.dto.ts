import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'admin@taskbox.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  otp!: string;

  @ApiProperty({ example: 'NewPassword!2026', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
