import { PositionStatus } from '@prisma/client';
import {
  PositionOptionDto,
  PositionResponseDto,
} from './dto/position.response';

type DateLike = Date | string;

export type PositionRecord = {
  id: string;
  code: string;
  name: string;
  status: PositionStatus;
  sortOrder: number;
  description: string | null;
  createdAt: DateLike;
  updatedAt: DateLike;
};

export type PositionOptionRecord = {
  id: string;
  code: string;
  name: string;
  status: PositionStatus;
};

function toIsoString(value: DateLike): string {
  return value instanceof Date ? value.toISOString() : value;
}

export function toPositionResponse(
  record: PositionRecord,
): PositionResponseDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    status: record.status,
    sortOrder: record.sortOrder,
    description: record.description,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

export function toPositionOption(
  record: PositionOptionRecord,
): PositionOptionDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    status: record.status,
  };
}
