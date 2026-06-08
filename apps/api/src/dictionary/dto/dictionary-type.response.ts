import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DictionaryStatus } from '@prisma/client';
import { ListResponse } from '../../common/dto/list-response.dto';

export class DictionaryTypeResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  code!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: DictionaryStatus })
  status!: DictionaryStatus;

  @ApiProperty()
  isSystem!: boolean;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class DictionaryTypeListResponseDto
  implements ListResponse<DictionaryTypeResponseDto>
{
  @ApiProperty({ type: [DictionaryTypeResponseDto] })
  items!: DictionaryTypeResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}
