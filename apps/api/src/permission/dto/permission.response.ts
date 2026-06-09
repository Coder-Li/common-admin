import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PermissionStatus } from '@prisma/client';

export class PermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  module!: string;

  @ApiProperty()
  action!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty({ enum: PermissionStatus })
  status!: PermissionStatus;

  @ApiProperty()
  sortOrder!: number;
}

export class PermissionModuleResponseDto {
  @ApiProperty()
  module!: string;

  @ApiProperty({ type: [PermissionResponseDto] })
  permissions!: PermissionResponseDto[];
}
