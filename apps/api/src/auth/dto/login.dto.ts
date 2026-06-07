import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @IsString()
  usernameOrEmail!: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(8)
  password!: string;
}
