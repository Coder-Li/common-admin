import { Controller, Get } from '@nestjs/common';
import { IsPublic } from '../common/decorators/is-public.decorator';

@Controller('health')
export class HealthController {
  @IsPublic()
  @Get()
  check() {
    return { status: 'ok' };
  }
}
