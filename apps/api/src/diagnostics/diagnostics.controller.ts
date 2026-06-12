import { Controller, Get } from '@nestjs/common';
import { IsPublic } from '../common/decorators/is-public.decorator';

@Controller('diagnostics')
export class DiagnosticsController {
  @IsPublic()
  @Get('error')
  throwError(): never {
    throw new Error('Diagnostic error');
  }
}
