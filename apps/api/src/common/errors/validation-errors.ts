import type { ValidationError } from 'class-validator';

export interface ValidationFieldError {
  field: string;
  message: string;
}

export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): ValidationFieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownMessages = Object.values(error.constraints ?? {}).map(
      (message) => ({
        field,
        message,
      }),
    );
    return [
      ...ownMessages,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}
