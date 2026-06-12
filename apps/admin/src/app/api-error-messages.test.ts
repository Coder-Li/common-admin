import { describe, expect, it } from 'vitest'
import { messages } from '../i18n/messages'
import { getErrorMessage } from './api-error-messages'
import type { ApiError } from './api-error'

const englishMessages: Record<string, string> = messages['en-US']

const t = (key: string, values: Record<string, string> = {}) =>
  englishMessages[key].replace(/\{(\w+)\}/g, (token, valueKey: string) =>
    values[valueKey] ?? token,
  )

function apiError(
  code: string,
  message = 'Backend detail that should not win',
  requestId?: string,
): ApiError {
  return {
    code,
    message,
    requestId,
  }
}

describe('getErrorMessage', () => {
  it('returns localized messages for known API error codes', () => {
    expect(getErrorMessage(apiError('NETWORK_ERROR'), 'Fallback', t)).toBe(
      englishMessages['errors.network'],
    )
    expect(getErrorMessage(apiError('VALIDATION_ERROR'), 'Fallback', t)).toBe(
      englishMessages['errors.validation'],
    )
    expect(getErrorMessage(apiError('FORBIDDEN'), 'Fallback', t)).toBe(
      englishMessages['errors.forbidden'],
    )
  })

  it.each([
    ['USER_EMAIL_ALREADY_EXISTS', 'errors.userEmailAlreadyExists'],
    ['ROLE_CODE_ALREADY_EXISTS', 'errors.roleCodeAlreadyExists'],
    ['DICTIONARY_CODE_ALREADY_EXISTS', 'errors.dictionaryCodeAlreadyExists'],
    ['FILE_UPLOAD_REQUIRED', 'errors.fileUploadRequired'],
    ['FILE_NOT_FOUND', 'errors.fileNotFound'],
  ])('returns code-specific localized messages for %s', (code, key) => {
    expect(getErrorMessage(apiError(code), 'Fallback', t)).toBe(
      englishMessages[key],
    )
  })

  it.each([
    ['RATE_LIMITED', 'errors.rateLimited'],
    ['PAYLOAD_TOO_LARGE', 'errors.payloadTooLarge'],
    ['UNSUPPORTED_MEDIA_TYPE', 'errors.unsupportedMediaType'],
  ])('returns shared localized messages for %s', (code, key) => {
    expect(getErrorMessage(apiError(code), 'Fallback', t)).toBe(
      englishMessages[key],
    )
  })

  it.each([
    ['BAD_REQUEST', 'errors.badRequest'],
    ['UNAUTHORIZED', 'errors.unauthorized'],
    ['NOT_FOUND', 'errors.notFound'],
    ['SERVICE_UNAVAILABLE', 'errors.serviceUnavailable'],
  ])('returns localized infrastructure messages for %s', (code, key) => {
    expect(getErrorMessage(apiError(code), 'Fallback', t)).toBe(
      englishMessages[key],
    )
  })

  it('includes request id for internal server errors when present', () => {
    expect(
      getErrorMessage(
        apiError('INTERNAL_SERVER_ERROR', 'Boom', 'req-123'),
        'Fallback',
        t,
      ),
    ).toBe('Something went wrong. Request ID: req-123')
  })

  it('uses default English messages for known codes without a translator', () => {
    expect(
      getErrorMessage(apiError('USER_EMAIL_ALREADY_EXISTS'), 'Fallback'),
    ).toBe('A user with this email already exists.')
  })

  it('uses fallback for unknown API errors before backend details', () => {
    expect(
      getErrorMessage(
        apiError('SOMETHING_NEW', 'Backend detail that should stay hidden'),
        'Fallback',
        t,
      ),
    ).toBe('Fallback')
  })

  it('uses backend API message for unknown errors only when fallback is empty', () => {
    expect(
      getErrorMessage(apiError('SOMETHING_NEW', 'Backend detail'), '', t),
    ).toBe('Backend detail')
  })

  it('returns fallback-safe text for raw Error values', () => {
    expect(getErrorMessage(new Error('Secret raw details'), 'Fallback', t)).toBe(
      'Fallback',
    )
    expect(getErrorMessage(new Error('Secret raw details'), '', t)).toBe(
      englishMessages['errors.unknown'],
    )
  })
})
