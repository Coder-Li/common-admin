import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  Matches,
  IsEmail,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';

const USER_SORT_FIELDS = [
  'email',
  'username',
  'firstName',
  'lastName',
  'createdAt',
  'updatedAt',
];

export class UserListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  roleCode?: string;

  @ApiPropertyOptional({ example: 'dept-1' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'pos-1' })
  @IsOptional()
  @IsString()
  positionId?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roleCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ example: 'dept-1' })
  @IsOptional()
  @IsString()
  primaryDepartmentId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  positionIds?: string[];
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departmentIds?: string[];

  @ApiPropertyOptional({ example: 'dept-1' })
  @IsOptional()
  @IsString()
  primaryDepartmentId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  positionIds?: string[];
}

export class ReplaceUserRolesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleCodes!: string[];
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
