import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryBadgeVariant, DictionaryStatus } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class DictionaryItemResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  typeId!: string;

  @ApiProperty()
  typeCode!: string;

  @ApiProperty()
  typeName!: string;

  @ApiProperty()
  value!: string;

  @ApiProperty()
  label!: string;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ enum: DictionaryStatus })
  status!: DictionaryStatus;

  @ApiProperty()
  isSystem!: boolean;

  @ApiProperty()
  isDefault!: boolean;

  @ApiPropertyOptional({ enum: DictionaryBadgeVariant })
  badgeVariant?: DictionaryBadgeVariant;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class DictionaryItemListResponseDto implements ListResponse<DictionaryItemResponseDto> {
  @ApiProperty({ type: [DictionaryItemResponseDto] })
  items!: DictionaryItemResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
