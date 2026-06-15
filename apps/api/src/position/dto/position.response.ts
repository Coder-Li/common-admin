import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PositionStatus } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class PositionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: PositionStatus })
  status!: PositionStatus;

  @ApiProperty()
  sortOrder!: number;

  @ApiPropertyOptional({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class PositionListResponseDto implements ListResponse<PositionResponseDto> {
  @ApiProperty({ type: [PositionResponseDto] })
  items!: PositionResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

export class PositionOptionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: PositionStatus })
  status!: PositionStatus;
}
