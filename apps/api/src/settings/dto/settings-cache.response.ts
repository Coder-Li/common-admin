import { ApiProperty } from '@nestjs/swagger';

export class DictionaryCacheRefreshResponseDto {
  @ApiProperty({ format: 'date-time' })
  refreshedAt!: string;
}
