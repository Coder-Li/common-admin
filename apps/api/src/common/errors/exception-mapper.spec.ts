import { AppException } from './app-exception';
import { ERROR_CODES } from './error-codes';
import { ErrorResponseDto } from './error-response.dto';

describe('AppException', () => {
  it('stores a stable code, status, message, and details', () => {
    const exception = new AppException({
      code: ERROR_CODES.CONFLICT,
      message: 'Conflict',
      statusCode: 409,
      details: { field: 'email' },
    });

    expect(exception.getStatus()).toBe(409);
    expect(exception.code).toBe(ERROR_CODES.CONFLICT);
    expect(exception.message).toBe('Conflict');
    expect(exception.details).toEqual({ field: 'email' });
  });

  it('exports the public error response DTO', () => {
    expect(ErrorResponseDto).toEqual(expect.any(Function));
  });
});
