import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Matches,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { Role } from '../role.enum';

const USER_SORT_FIELDS = [
  'email',
  'username',
  'firstName',
  'lastName',
  'role',
  'createdAt',
  'updatedAt',
];

export class UserListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: `Sort by one of: ${USER_SORT_FIELDS.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(new RegExp(`^(${USER_SORT_FIELDS.join('|')}):(asc|desc)$`), {
    message: `sort must use an allowed user field and asc or desc direction`,
  })
  declare sort?: string;
}

export class CreateUserDto {
  @ApiProperty({ example: 'admin@example.com', maxLength: 255 })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: 'admin', minLength: 3, maxLength: 80 })
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  username!: string;

  @ApiProperty({ example: 'Ada', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: 'Lovelace', minLength: 1, maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: Role })
  @IsEnum(Role)
  role!: Role;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'admin@example.com', maxLength: 255 })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'admin', minLength: 3, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(80)
  username?: string;

  @ApiPropertyOptional({ example: 'Ada', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Lovelace', minLength: 1, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
