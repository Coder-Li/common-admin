import { isAxiosError } from 'axios'

export type ApiError = {
  code: string
  message: string
  statusCode?: number
  requestId?: string
  path?: string
  timestamp?: string
  details?: unknown
  cause?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function responseHeader(headers: unknown, name: string) {
  if (!isRecord(headers)) {
    return undefined
  }

  return stringValue(headers[name]) ?? stringValue(headers[name.toLowerCase()])
}

export function isApiError(error: unknown): error is ApiError {
  return (
    isRecord(error) &&
    typeof error.code === 'string' &&
    typeof error.message === 'string'
  )
}

export function toApiError(error: unknown): ApiError {
  if (isApiError(error)) {
    return error
  }

  if (!isAxiosError(error)) {
    return {
      code: 'UNKNOWN_API_ERROR',
      message: 'Unknown API error',
      cause: error,
    }
  }

  const { response } = error

  if (!response) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      cause: error,
    }
  }

  const { data } = response

  if (
    !isRecord(data) ||
    typeof data.code !== 'string' ||
    typeof data.message !== 'string'
  ) {
    return {
      code: 'UNKNOWN_API_ERROR',
      message: 'Unknown API error',
      statusCode: response.status,
      cause: error,
    }
  }

  const apiError: ApiError = {
    code: data.code,
    message: data.message,
    statusCode:
      typeof data.statusCode === 'number' ? data.statusCode : response.status,
  }
  const requestId =
    stringValue(data.requestId) ??
    responseHeader(response.headers, 'x-request-id')

  if (requestId) {
    apiError.requestId = requestId
  }

  const path = stringValue(data.path)
  if (path) {
    apiError.path = path
  }

  const timestamp = stringValue(data.timestamp)
  if (timestamp) {
    apiError.timestamp = timestamp
  }

  if ('details' in data) {
    apiError.details = data.details
  }

  return apiError
}

export function getValidationFieldErrors(
  error: unknown,
): Array<{ field: string; message: string }> {
  const apiError = toApiError(error)

  if (!isRecord(apiError.details) || !Array.isArray(apiError.details.fields)) {
    return []
  }

  return apiError.details.fields.filter(
    (fieldError): fieldError is { field: string; message: string } =>
      isRecord(fieldError) &&
      typeof fieldError.field === 'string' &&
      typeof fieldError.message === 'string',
  )
}
