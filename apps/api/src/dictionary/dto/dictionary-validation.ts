import { TransformFnParams } from 'class-transformer';
import {
  buildMessage,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

export const DICTIONARY_CODE_PATTERN = /^[a-z0-9_]{2,80}$/;

export function transformOptionalBoolean({
  value,
}: TransformFnParams): unknown {
  if (value === true || value === false || value === undefined) {
    return value;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return value;
}

export function transformDictionaryTypes({
  value,
}: TransformFnParams): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  return value.split(',');
}

export function IsPlainRecord(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isPlainRecord',
      target: object.constructor,
      propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (
            value === null ||
            typeof value !== 'object' ||
            Array.isArray(value)
          ) {
            return false;
          }

          const prototype: unknown = Object.getPrototypeOf(value);

          return prototype === Object.prototype || prototype === null;
        },
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a plain object`,
          validationOptions,
        ),
      },
    });
  };
}
