import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import {
  USER_SESSION_SORT_FIELDS,
  USER_SESSION_STATUSES,
} from '../user-session.constants';

const USER_SESSION_SORT_FIELD_VALUES = [...USER_SESSION_SORT_FIELDS];

@ValidatorConstraint({ name: 'dateToNotBeforeDateFrom', async: false })
class DateToNotBeforeDateFromConstraint implements ValidatorConstraintInterface {
  validate(dateTo: unknown, args: ValidationArguments): boolean {
    const query = args.object as UserSessionListQueryDto;

    if (
      typeof query.dateFrom !== 'string' ||
      typeof dateTo !== 'string' ||
      !query.dateFrom ||
      !dateTo
    ) {
      return true;
    }

    return new Date(query.dateFrom) <= new Date(dateTo);
  }

  defaultMessage(): string {
    return 'dateTo must be greater than or equal to dateFrom';
  }
}

export class UserSessionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: USER_SESSION_STATUSES })
  @IsOptional()
  @IsIn(USER_SESSION_STATUSES)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(120)
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined,
  )
  @IsString()
  @MaxLength(80)
  ipAddress?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-30T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  @Validate(DateToNotBeforeDateFromConstraint)
  dateTo?: string;

  @ApiPropertyOptional({
    example: 'createdAt:desc',
    description: `Sort by one of: ${USER_SESSION_SORT_FIELD_VALUES.join(', ')}`,
  })
  @IsOptional()
  @IsString()
  @Matches(
    new RegExp(`^(${USER_SESSION_SORT_FIELD_VALUES.join('|')}):(asc|desc)$`),
    {
      message:
        'sort must use an allowed user session field and asc or desc direction',
    },
  )
  declare sort?: string;
}
