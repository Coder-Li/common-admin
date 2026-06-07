export interface ListResponse<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function createListResponse<TItem>(
  items: TItem[],
  total: number,
  page: number,
  pageSize: number,
): ListResponse<TItem> {
  return { items, total, page, pageSize };
}
