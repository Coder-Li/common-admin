import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DepartmentStatus } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class DepartmentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentId!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentName!: string | null;

  @ApiProperty({ enum: DepartmentStatus })
  status!: DepartmentStatus;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class DepartmentListResponseDto implements ListResponse<DepartmentResponseDto> {
  @ApiProperty({ type: [DepartmentResponseDto] })
  items!: DepartmentResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class DepartmentTreeNodeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ enum: DepartmentStatus })
  status!: DepartmentStatus;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ type: () => [DepartmentTreeNodeDto] })
  children!: DepartmentTreeNodeDto[];
}

export class DepartmentOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  parentId!: string | null;

  @ApiProperty({ enum: DepartmentStatus })
  status!: DepartmentStatus;
}
