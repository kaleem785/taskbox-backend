import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@taskbox.pk' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'ChangeMe!2026', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
