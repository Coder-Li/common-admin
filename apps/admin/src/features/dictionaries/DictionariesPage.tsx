import {
  useId,
  useMemo,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import { useI18n } from '../../i18n/useI18n'
import { useServerTableQuery } from '../../lib/crud/useServerTableQuery'
import { DictionaryItemForm } from './DictionaryItemForm'
import { DictionaryTypeForm } from './DictionaryTypeForm'
import {
  createDictionaryItem,
  createDictionaryType,
  deleteDictionaryItem,
  deleteDictionaryType,
  listDictionaryItems,
  listDictionaryTypes,
  updateDictionaryItem,
  updateDictionaryType,
} from './dictionaries.api'
import { createDictionaryItemColumns } from './dictionary-item.columns'
import { createDictionaryTypeColumns } from './dictionary-type.columns'
import type {
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  DictionaryItemListQuery,
  DictionaryItemRecord,
  DictionaryTypeListQuery,
  DictionaryTypeRecord,
  UpdateDictionaryItemRequest,
  UpdateDictionaryTypeRequest,
} from './dictionaries.types'

type TypeFormState =
  | { mode: 'create'; type?: undefined }
  | { mode: 'edit'; type: DictionaryTypeRecord }
  | null

type ItemFormState =
  | { mode: 'create'; item?: undefined }
  | { mode: 'edit'; item: DictionaryItemRecord }
  | null

type DeleteState =
  | { kind: 'type'; record: DictionaryTypeRecord }
  | { kind: 'item'; record: DictionaryItemRecord }
  | null

function mutationErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined
}

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function emptyItemResponse(page: number, pageSize: number) {
  return {
    items: [],
    page,
    pageSize,
    total: 0,
  }
}

export function DictionariesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [typeSearch, setTypeSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [typePagination, setTypePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [itemPagination, setItemPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [typeSorting, setTypeSorting] = useState<SortingState>([])
  const [itemSorting, setItemSorting] = useState<SortingState>([])
  const [typeFormState, setTypeFormState] = useState<TypeFormState>(null)
  const [itemFormState, setItemFormState] = useState<ItemFormState>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>(null)

  const typeQuery = useServerTableQuery<
    DictionaryTypeRecord,
    object,
    DictionaryTypeListQuery
  >({
    resource: 'dictionaryTypes',
    state: {
      filters: {},
      pageIndex: typePagination.pageIndex,
      pageSize: typePagination.pageSize,
      search: typeSearch,
      sort: toSortParam(typeSorting),
    },
    queryFn: listDictionaryTypes,
  })

  const typeItems = typeQuery.data?.items ?? []
  const selectedType =
    typeItems.find((type) => type.id === selectedTypeId) ?? typeItems[0] ?? null

  const itemQuery = useServerTableQuery<
    DictionaryItemRecord,
    { typeId?: string },
    DictionaryItemListQuery
  >({
    resource: 'dictionaryItems',
    state: {
      filters: selectedType ? { typeId: selectedType.id } : {},
      pageIndex: itemPagination.pageIndex,
      pageSize: itemPagination.pageSize,
      search: itemSearch,
      sort: toSortParam(itemSorting),
    },
    queryFn: (query) =>
      selectedType
        ? listDictionaryItems(query)
        : Promise.resolve(emptyItemResponse(query.page, query.pageSize)),
  })

  const invalidateTypes = () =>
    queryClient.invalidateQueries({ queryKey: ['dictionaryTypes', 'list'] })
  const invalidateItems = () =>
    queryClient.invalidateQueries({ queryKey: ['dictionaryItems', 'list'] })
  const invalidateOptions = () =>
    queryClient.invalidateQueries({ queryKey: ['dictionaries', 'options'] })

  const createTypeMutation = useMutation({
    mutationFn: (payload: CreateDictionaryTypeRequest) =>
      createDictionaryType(payload),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.error.createType'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.success.createType'))
      setTypeFormState(null)
      await invalidateTypes()
    },
  })

  const updateTypeMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateDictionaryTypeRequest }) =>
      updateDictionaryType(payload.id, payload.value),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.error.updateType'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.success.updateType'))
      setTypeFormState(null)
      await invalidateTypes()
      await invalidateOptions()
    },
  })

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => deleteDictionaryType(id),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.delete.typeError'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.delete.typeSuccess'))
      setDeleteState(null)
      setSelectedTypeId(null)
      await invalidateTypes()
      await invalidateItems()
      await invalidateOptions()
    },
  })

  const createItemMutation = useMutation({
    mutationFn: (payload: CreateDictionaryItemRequest) =>
      createDictionaryItem(payload),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.error.createItem'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.success.createItem'))
      setItemFormState(null)
      await invalidateItems()
      await invalidateOptions()
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateDictionaryItemRequest }) =>
      updateDictionaryItem(payload.id, payload.value),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.error.updateItem'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.success.updateItem'))
      setItemFormState(null)
      await invalidateItems()
      await invalidateOptions()
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteDictionaryItem(id),
    onError: (error) => {
      toast.error(mutationErrorMessage(error) ?? t('dictionaries.delete.itemError'))
    },
    onSuccess: async () => {
      toast.success(t('dictionaries.delete.itemSuccess'))
      setDeleteState(null)
      await invalidateItems()
      await invalidateOptions()
    },
  })

  const typeColumns = useMemo(
    () =>
      createDictionaryTypeColumns(
        {
          actions: t('dictionaries.column.actions'),
          code: t('dictionaries.column.code'),
          delete: t('dictionaries.action.delete'),
          edit: t('dictionaries.action.edit'),
          name: t('dictionaries.column.name'),
          select: t('dictionaries.action.select'),
          status: t('dictionaries.column.status'),
          system: t('dictionaries.column.system'),
          systemNo: t('dictionaries.system.no'),
          systemYes: t('dictionaries.system.yes'),
          updatedAt: t('dictionaries.column.updatedAt'),
        },
        {
          onDelete: (type) => setDeleteState({ kind: 'type', record: type }),
          onEdit: (type) => setTypeFormState({ mode: 'edit', type }),
          onSelect: (type) => {
            setSelectedTypeId(type.id)
            setItemPagination((currentPagination) => ({
              ...currentPagination,
              pageIndex: 0,
            }))
          },
          selectedTypeId: selectedType?.id,
        },
      ),
    [selectedType?.id, t],
  )

  const itemColumns = useMemo(
    () =>
      createDictionaryItemColumns(
        {
          actions: t('dictionaries.column.actions'),
          badgeVariant: t('dictionaries.column.badgeVariant'),
          default: t('dictionaries.column.default'),
          defaultNo: t('dictionaries.default.no'),
          defaultYes: t('dictionaries.default.yes'),
          delete: t('dictionaries.action.delete'),
          edit: t('dictionaries.action.edit'),
          label: t('dictionaries.column.label'),
          sortOrder: t('dictionaries.column.sortOrder'),
          status: t('dictionaries.column.status'),
          updatedAt: t('dictionaries.column.updatedAt'),
          value: t('dictionaries.column.value'),
        },
        {
          onDelete: (item) => setDeleteState({ kind: 'item', record: item }),
          onEdit: (item) => setItemFormState({ mode: 'edit', item }),
        },
      ),
    [t],
  )

  const handleTypePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setTypePagination((currentPagination) =>
      typeof updater === 'function' ? updater(currentPagination) : updater,
    )
  }

  const handleItemPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setItemPagination((currentPagination) =>
      typeof updater === 'function' ? updater(currentPagination) : updater,
    )
  }

  const handleTypeSortingChange: OnChangeFn<SortingState> = (updater) => {
    setTypePagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
    setTypeSorting((currentSorting) =>
      typeof updater === 'function' ? updater(currentSorting) : updater,
    )
  }

  const handleItemSortingChange: OnChangeFn<SortingState> = (updater) => {
    setItemPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
    setItemSorting((currentSorting) =>
      typeof updater === 'function' ? updater(currentSorting) : updater,
    )
  }

  function handleTypeSearchChange(value: string) {
    setTypeSearch(value)
    setTypePagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleItemSearchChange(value: string) {
    setItemSearch(value)
    setItemPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function handleTypeSubmit(
    value: CreateDictionaryTypeRequest | UpdateDictionaryTypeRequest,
  ) {
    if (typeFormState?.mode === 'edit') {
      updateTypeMutation.mutate({
        id: typeFormState.type.id,
        value: value as UpdateDictionaryTypeRequest,
      })
      return
    }

    createTypeMutation.mutate(value as CreateDictionaryTypeRequest)
  }

  function handleItemSubmit(
    value: CreateDictionaryItemRequest | UpdateDictionaryItemRequest,
  ) {
    if (itemFormState?.mode === 'edit') {
      updateItemMutation.mutate({
        id: itemFormState.item.id,
        value: value as UpdateDictionaryItemRequest,
      })
      return
    }

    createItemMutation.mutate(value as CreateDictionaryItemRequest)
  }

  function confirmDelete() {
    if (deleteState?.kind === 'type') {
      deleteTypeMutation.mutate(deleteState.record.id)
      return
    }

    if (deleteState?.kind === 'item') {
      deleteItemMutation.mutate(deleteState.record.id)
    }
  }

  const typeError =
    typeQuery.error instanceof Error
      ? typeQuery.error
      : typeQuery.error
        ? new Error(t('dictionaries.error.loadTypes'))
        : null
  const itemError =
    itemQuery.error instanceof Error
      ? itemQuery.error
      : itemQuery.error
        ? new Error(t('dictionaries.error.loadItems'))
        : null

  return (
    <section className="grid gap-5 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('dictionaries.title')}
        </h2>
        <button
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
          onClick={() => setTypeFormState({ mode: 'create' })}
          type="button"
        >
          <Plus size={16} />
          {t('dictionaries.action.createType')}
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <DataTable
          columns={typeColumns}
          data={typeQuery.data?.items ?? []}
          emptyLabel={t('dictionaries.state.emptyTypes')}
          error={typeError}
          errorLabel={t('dictionaries.error.loadTypes')}
          isLoading={typeQuery.isLoading}
          loadingLabel={t('dictionaries.state.loadingTypes')}
          onPaginationChange={handleTypePaginationChange}
          onRetry={() => typeQuery.refetch()}
          onSortingChange={handleTypeSortingChange}
          pagination={typePagination}
          retryLabel={t('dictionaries.state.retry')}
          sorting={typeSorting}
          toolbar={
            <DataTableToolbar
              onSearchChange={handleTypeSearchChange}
              searchLabel={t('dictionaries.search.types')}
              searchPlaceholder={t('dictionaries.search.types')}
              searchValue={typeSearch}
            />
          }
          total={typeQuery.data?.total ?? 0}
        />

        <div className="grid min-w-0 gap-3">
          <div className="flex min-h-9 items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-950">
                {selectedType
                  ? selectedType.name
                  : t('dictionaries.item.noTypeSelected')}
              </h3>
              <p className="truncate text-xs text-slate-500">
                {selectedType?.code ?? t('dictionaries.item.selectType')}
              </p>
            </div>
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedType}
              onClick={() => setItemFormState({ mode: 'create' })}
              type="button"
            >
              <Plus size={16} />
              {t('dictionaries.action.createItem')}
            </button>
          </div>

          <DataTable
            columns={itemColumns}
            data={itemQuery.data?.items ?? []}
            emptyLabel={t('dictionaries.state.emptyItems')}
            error={itemError}
            errorLabel={t('dictionaries.error.loadItems')}
            isLoading={itemQuery.isLoading}
            loadingLabel={t('dictionaries.state.loadingItems')}
            onPaginationChange={handleItemPaginationChange}
            onRetry={() => itemQuery.refetch()}
            onSortingChange={handleItemSortingChange}
            pagination={itemPagination}
            retryLabel={t('dictionaries.state.retry')}
            sorting={itemSorting}
            toolbar={
              <DataTableToolbar
                onSearchChange={handleItemSearchChange}
                searchLabel={t('dictionaries.search.items')}
                searchPlaceholder={t('dictionaries.search.items')}
                searchValue={itemSearch}
              />
            }
            total={itemQuery.data?.total ?? 0}
          />
        </div>
      </div>

      {typeFormState ? (
        <Modal
          title={
            typeFormState.mode === 'create'
              ? t('dictionaries.action.createType')
              : t('dictionaries.action.edit')
          }
        >
          <DictionaryTypeForm
            initialValue={
              typeFormState.mode === 'edit' ? typeFormState.type : undefined
            }
            isSubmitting={
              createTypeMutation.isPending || updateTypeMutation.isPending
            }
            mode={typeFormState.mode}
            onCancel={() => setTypeFormState(null)}
            onSubmit={handleTypeSubmit}
          />
        </Modal>
      ) : null}

      {itemFormState && selectedType ? (
        <Modal
          title={
            itemFormState.mode === 'create'
              ? t('dictionaries.action.createItem')
              : t('dictionaries.action.edit')
          }
        >
          <DictionaryItemForm
            initialValue={
              itemFormState.mode === 'edit' ? itemFormState.item : undefined
            }
            isSubmitting={
              createItemMutation.isPending || updateItemMutation.isPending
            }
            mode={itemFormState.mode}
            onCancel={() => setItemFormState(null)}
            onSubmit={handleItemSubmit}
            typeId={selectedType.id}
          />
        </Modal>
      ) : null}

      {deleteState ? (
        <Modal
          title={
            deleteState.kind === 'type'
              ? t('dictionaries.delete.typeTitle')
              : t('dictionaries.delete.itemTitle')
          }
          widthClassName="max-w-sm"
        >
          <p className="text-sm text-slate-600">
            {deleteState.kind === 'type'
              ? deleteState.record.code
              : deleteState.record.value}
          </p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              disabled={deleteTypeMutation.isPending || deleteItemMutation.isPending}
              onClick={() => setDeleteState(null)}
              type="button"
            >
              {t('dictionaries.form.cancel')}
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={deleteTypeMutation.isPending || deleteItemMutation.isPending}
              onClick={confirmDelete}
              type="button"
            >
              {deleteState.kind === 'type'
                ? t('dictionaries.delete.typeTitle')
                : t('dictionaries.delete.itemTitle')}
            </button>
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function Modal({
  children,
  title,
  widthClassName = 'max-w-2xl',
}: {
  children: ReactNode
  title: string
  widthClassName?: string
}) {
  const titleId = useId()

  return (
    <div
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <div className={`w-full ${widthClassName} rounded-lg border border-slate-200 bg-white p-5 shadow-xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-950" id={titleId}>
            {title}
          </h3>
        </div>
        {children}
      </div>
    </div>
  )
}
