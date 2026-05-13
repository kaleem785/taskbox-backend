import { ApiProperty } from '@nestjs/swagger';
import { Role } from '../../../prisma/client';

export class AuthUserDto {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ enum: Role })
  role!: Role;
}

export class TokenPairDto {
  @ApiProperty()
  accessToken!: string;
  @ApiProperty()
  refreshToken!: string;
  @ApiProperty({ description: 'Access token TTL in seconds' })
  expiresIn!: number;
}

export class LoginResponseDto extends TokenPairDto {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
