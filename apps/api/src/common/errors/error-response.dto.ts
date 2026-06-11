import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ErrorFieldDto {
  @ApiProperty()
  field!: string;

  @ApiProperty()
  message!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Request validation failed' })
  message!: string;

  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'req_01HZ0000000000000000000000' })
  requestId!: string;

  @ApiProperty({ example: '/api/users' })
  path!: string;

  @ApiProperty({ example: '2026-06-11T10:20:30.000Z' })
  timestamp!: string;

  @ApiPropertyOptional({
    example: {
      fields: [{ field: 'email', message: 'email must be an email' }],
    },
  })
  details?: unknown;
}
