import { Controller, Get } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { IsPublic } from '../common/decorators/is-public.decorator';

@Controller('health')
export class HealthController {
  @IsPublic()
  @ApiOperation({ operationId: 'checkHealth' })
  @Get()
  check() {
    return { status: 'ok' };
  }
}
