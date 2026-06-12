import { messages, type MessageKey } from '../i18n/messages'
import { isApiError, toApiError } from './api-error'

type Translator = (key: string, values?: Record<string, string>) => string

const codeMessageKeys: Record<string, MessageKey> = {
  NETWORK_ERROR: 'errors.network',
  BAD_REQUEST: 'errors.badRequest',
  UNAUTHORIZED: 'errors.unauthorized',
  VALIDATION_ERROR: 'errors.validation',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  RATE_LIMITED: 'errors.rateLimited',
  PAYLOAD_TOO_LARGE: 'errors.payloadTooLarge',
  UNSUPPORTED_MEDIA_TYPE: 'errors.unsupportedMediaType',
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  CONFLICT: 'errors.conflict',
  USER_EMAIL_ALREADY_EXISTS: 'errors.userEmailAlreadyExists',
  ROLE_CODE_ALREADY_EXISTS: 'errors.roleCodeAlreadyExists',
  DICTIONARY_CODE_ALREADY_EXISTS: 'errors.dictionaryCodeAlreadyExists',
  FILE_UPLOAD_REQUIRED: 'errors.fileUploadRequired',
  FILE_NOT_FOUND: 'errors.fileNotFound',
}

function translate(
  key: MessageKey,
  t?: Translator,
  values?: Record<string, string>,
) {
  return t ? t(key, values) : messages['en-US'][key]
}

export function getErrorMessage(
  error: unknown,
  fallback: string,
  t?: Translator,
): string {
  const apiError = toApiError(error)

  if (!isApiError(error) && apiError.code === 'UNKNOWN_API_ERROR') {
    return fallback || translate('errors.unknown', t)
  }

  if (apiError.code === 'INTERNAL_SERVER_ERROR') {
    if (apiError.requestId) {
      return translate('errors.internalWithRequestId', t, {
        requestId: apiError.requestId,
      })
    }

    return translate('errors.internal', t)
  }

  const messageKey = codeMessageKeys[apiError.code]
  if (messageKey) {
    return translate(messageKey, t)
  }

  return fallback || apiError.message || translate('errors.unknown', t)
}
