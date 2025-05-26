import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class RefreshTokenRequestDto {
  @ApiPropertyOptional({
    description: 'The refresh token (if not sent via cookie).',
    example: 'refresh_token_string',
  })
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class RefreshTokenResponseDto {
  @ApiProperty({
    description: 'A message indicating the result of the refresh operation.',
    example: 'Token refreshed successfully',
  })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({
    description: 'The new access token (also set as an HTTP-only cookie).',
    example: 'new_access_token_jwt_string',
  })
  @IsString()
  @IsOptional()
  accessToken?: string;
}
