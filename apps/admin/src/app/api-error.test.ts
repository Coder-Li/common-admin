import type { AxiosError, AxiosResponse } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  getValidationFieldErrors,
  isApiError,
  toApiError,
  type ApiError,
} from './api-error'

function axiosError(
  data?: unknown,
  status = 400,
  headers: Record<string, string> = {},
) {
  return {
    isAxiosError: true,
    message: 'Request failed',
    response: {
      data,
      status,
      headers,
    } as AxiosResponse,
  } as AxiosError
}

describe('api error normalizer', () => {
  it('normalizes a server error envelope into an ApiError', () => {
    const error = toApiError(
      axiosError({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
        statusCode: 404,
        requestId: 'req-body-1',
        path: '/users/user-1',
        timestamp: '2026-06-12T09:00:00.000Z',
        details: { userId: 'user-1' },
      }),
    )

    expect(error).toEqual({
      code: 'USER_NOT_FOUND',
      message: 'User not found',
      statusCode: 404,
      requestId: 'req-body-1',
      path: '/users/user-1',
      timestamp: '2026-06-12T09:00:00.000Z',
      details: { userId: 'user-1' },
    })
    expect(isApiError(error)).toBe(true)
  })

  it('uses the response x-request-id header when the body lacks requestId', () => {
    expect(
      toApiError(
        axiosError(
          {
            code: 'FORBIDDEN',
            message: 'Forbidden',
          },
          403,
          { 'x-request-id': 'req-header-1' },
        ),
      ),
    ).toEqual({
      code: 'FORBIDDEN',
      message: 'Forbidden',
      statusCode: 403,
      requestId: 'req-header-1',
    })
  })

  it('normalizes network Axios errors into NETWORK_ERROR', () => {
    const networkError = {
      isAxiosError: true,
      message: 'Network Error',
    } as AxiosError

    expect(toApiError(networkError)).toEqual({
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      cause: networkError,
    })
  })

  it('normalizes malformed server responses into UNKNOWN_API_ERROR', () => {
    const error = axiosError({ message: ['invalid response'] }, 500)

    expect(toApiError(error)).toEqual({
      code: 'UNKNOWN_API_ERROR',
      message: 'Unknown API error',
      statusCode: 500,
      cause: error,
    })
  })

  it('extracts validation field details with string field and message pairs', () => {
    const error: ApiError = {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: {
        fields: [
          { field: 'email', message: 'Email is invalid' },
          { field: 'password', message: 'Password is required' },
          { field: 'name' },
          { field: 123, message: 'Ignored' },
        ],
      },
    }

    expect(getValidationFieldErrors(error)).toEqual([
      { field: 'email', message: 'Email is invalid' },
      { field: 'password', message: 'Password is required' },
    ])
  })
})
