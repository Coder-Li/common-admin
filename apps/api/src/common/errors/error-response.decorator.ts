import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { ErrorResponseDto } from './error-response.dto';

export function ApiCommonErrorResponses() {
  return applyDecorators(
    ApiBadRequestResponse({ type: ErrorResponseDto }),
    ApiInternalServerErrorResponse({ type: ErrorResponseDto }),
  );
}
