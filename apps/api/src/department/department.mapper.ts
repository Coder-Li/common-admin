import { DepartmentStatus } from '@prisma/client';
import {
  DepartmentOptionDto,
  DepartmentResponseDto,
  DepartmentTreeNodeDto,
} from './dto/department.response';

type DateLike = Date | string;

export type DepartmentRecord = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  status: DepartmentStatus;
  sortOrder: number;
  description: string | null;
  createdAt: DateLike;
  updatedAt: DateLike;
  parent?: { name: string } | null;
};

export type DepartmentOptionRecord = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  status: DepartmentStatus;
};

export type DepartmentTreeRecord = {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
  status: DepartmentStatus;
  sortOrder: number;
};

function toIsoString(value: DateLike): string {
  return value instanceof Date ? value.toISOString() : value;
}

function compareTreeNodes(
  first: DepartmentTreeNodeDto,
  second: DepartmentTreeNodeDto,
): number {
  return (
    first.sortOrder - second.sortOrder || first.name.localeCompare(second.name)
  );
}

export function toDepartmentResponse(
  record: DepartmentRecord,
): DepartmentResponseDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    parentId: record.parentId,
    parentName: record.parent?.name ?? null,
    status: record.status,
    sortOrder: record.sortOrder,
    description: record.description,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
  };
}

export function toDepartmentOption(
  record: DepartmentOptionRecord,
): DepartmentOptionDto {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    parentId: record.parentId,
    status: record.status,
  };
}

export function toDepartmentTree(
  records: DepartmentTreeRecord[],
): DepartmentTreeNodeDto[] {
  const nodes = new Map<string, DepartmentTreeNodeDto>();

  for (const record of records) {
    nodes.set(record.id, {
      id: record.id,
      code: record.code,
      name: record.name,
      parentId: record.parentId,
      status: record.status,
      sortOrder: record.sortOrder,
      children: [],
    });
  }

  const roots: DepartmentTreeNodeDto[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortSiblings = (siblings: DepartmentTreeNodeDto[]) => {
    siblings.sort(compareTreeNodes);
    for (const sibling of siblings) {
      sortSiblings(sibling.children);
    }
  };

  sortSiblings(roots);

  return roots;
}
