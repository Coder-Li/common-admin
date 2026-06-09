import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  MouseEvent,
  ReactNode,
} from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { DataTable } from '../../components/data-table/DataTable'
import { DataTableToolbar } from '../../components/data-table/DataTableToolbar'
import type {
  PaginationState,
  SortingState,
} from '../../components/data-table/DataTable'
import { useI18n } from '../../i18n/useI18n'
import { useServerTableQuery } from '../../lib/crud/useServerTableQuery'
import { can } from '../../lib/permissions'
import { useAuthStore } from '../../stores/auth-store'
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

type TypeContextMenuState = {
  type: DictionaryTypeRecord
  x: number
  y: number
} | null

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
  const permissions = useAuthStore((state) => state.permissions)
  const [typeSearch, setTypeSearch] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const typePagination: PaginationState = {
    pageIndex: 0,
    pageSize: 100,
  }
  const [itemPagination, setItemPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [itemSorting, setItemSorting] = useState<SortingState>([])
  const [typeFormState, setTypeFormState] = useState<TypeFormState>(null)
  const [itemFormState, setItemFormState] = useState<ItemFormState>(null)
  const [deleteState, setDeleteState] = useState<DeleteState>(null)
  const [typeContextMenu, setTypeContextMenu] =
    useState<TypeContextMenuState>(null)
  const canCreate = can(permissions, 'dictionary.create')
  const canUpdate = can(permissions, 'dictionary.update')
  const canDelete = can(permissions, 'dictionary.delete')

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
      sort: 'updatedAt:desc',
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
          canDelete,
          canUpdate,
          onDelete: (item) => setDeleteState({ kind: 'item', record: item }),
          onEdit: (item) => setItemFormState({ mode: 'edit', item }),
        },
      ),
    [canDelete, canUpdate, t],
  )

  const handleItemPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setItemPagination((currentPagination) =>
      typeof updater === 'function' ? updater(currentPagination) : updater,
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

  function handleTypeSelect(type: DictionaryTypeRecord) {
    setSelectedTypeId(type.id)
    setTypeContextMenu(null)
    setItemPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  function openTypeContextMenu(
    event: MouseEvent,
    type: DictionaryTypeRecord,
  ) {
    event.preventDefault()
    setTypeContextMenu({
      type,
      x: event.clientX,
      y: event.clientY,
    })
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
    <section className="grid min-h-[calc(100vh-8rem)] gap-0 bg-white lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-h-[22rem] min-w-0 flex-col border-b border-slate-200 bg-white lg:border-b-0 lg:border-r">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3">
          <h2 className="truncate text-sm font-semibold text-slate-950">
            {t('dictionaries.type.title')}
          </h2>
          <div className="flex items-center gap-1">
            <button
              aria-label={t('dictionaries.action.refresh')}
              className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={() => typeQuery.refetch()}
              type="button"
            >
              <RefreshCw size={16} />
            </button>
            {canCreate ? (
              <button
                aria-label={t('dictionaries.action.createType')}
                className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                onClick={() => setTypeFormState({ mode: 'create' })}
                type="button"
              >
                <Plus size={17} />
              </button>
            ) : null}
          </div>
        </div>

        <div className="border-b border-slate-200 p-3">
          <label className="relative block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              aria-label={t('dictionaries.search.types')}
              className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500"
              onChange={(event) => handleTypeSearchChange(event.target.value)}
              placeholder={t('dictionaries.search.types')}
              type="search"
              value={typeSearch}
            />
          </label>
        </div>

        <DictionaryTypeList
          deleteLabel={t('dictionaries.action.delete')}
          editLabel={t('dictionaries.action.edit')}
          emptyLabel={t('dictionaries.state.emptyTypes')}
          error={typeError}
          errorLabel={t('dictionaries.error.loadTypes')}
          isLoading={typeQuery.isLoading}
          items={typeItems}
          loadingLabel={t('dictionaries.state.loadingTypes')}
          onContextMenu={openTypeContextMenu}
          onRetry={() => typeQuery.refetch()}
          onSelect={handleTypeSelect}
          retryLabel={t('dictionaries.state.retry')}
          selectLabel={t('dictionaries.action.select')}
          selectedTypeId={selectedType?.id}
          systemLabel={t('dictionaries.system.yes')}
          title={t('dictionaries.type.listLabel')}
          canOpenMenu={canUpdate || canDelete}
        />
      </aside>

      <div className="grid min-w-0 content-start gap-3 p-4">
        <div className="flex min-h-12 items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-950">
              {selectedType
                ? `${t('dictionaries.item.title')} (${selectedType.name})`
                : t('dictionaries.item.noTypeSelected')}
            </h3>
            <p className="truncate text-xs text-slate-500">
              {selectedType?.code ?? t('dictionaries.item.selectType')}
            </p>
          </div>
          {canCreate ? (
            <button
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!selectedType}
              onClick={() => setItemFormState({ mode: 'create' })}
              type="button"
            >
              <Plus size={16} />
              {t('dictionaries.action.createItem')}
            </button>
          ) : null}
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

      {typeContextMenu ? (
        <DictionaryTypeContextMenu
          deleteLabel={t('dictionaries.action.delete')}
          editLabel={t('dictionaries.action.edit')}
          isSystem={typeContextMenu.type.isSystem}
          canDelete={canDelete}
          canUpdate={canUpdate}
          onDelete={() => {
            setDeleteState({ kind: 'type', record: typeContextMenu.type })
            setTypeContextMenu(null)
          }}
          onEdit={() => {
            setTypeFormState({ mode: 'edit', type: typeContextMenu.type })
            setTypeContextMenu(null)
          }}
          onRequestClose={() => setTypeContextMenu(null)}
          x={typeContextMenu.x}
          y={typeContextMenu.y}
        />
      ) : null}

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

function DictionaryTypeList({
  canOpenMenu,
  deleteLabel,
  editLabel,
  emptyLabel,
  error,
  errorLabel,
  isLoading,
  items,
  loadingLabel,
  onContextMenu,
  onRetry,
  onSelect,
  retryLabel,
  selectLabel,
  selectedTypeId,
  systemLabel,
  title,
}: {
  canOpenMenu: boolean
  deleteLabel: string
  editLabel: string
  emptyLabel: string
  error: Error | null
  errorLabel: string
  isLoading: boolean
  items: DictionaryTypeRecord[]
  loadingLabel: string
  onContextMenu: (event: MouseEvent, type: DictionaryTypeRecord) => void
  onRetry: () => void
  onSelect: (type: DictionaryTypeRecord) => void
  retryLabel: string
  selectLabel: string
  selectedTypeId?: string
  systemLabel: string
  title: string
}) {
  if (isLoading) {
    return (
      <div className="grid flex-1 place-items-center px-4 text-sm text-slate-500">
        {loadingLabel}
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid flex-1 place-items-center px-4 text-center text-sm text-slate-500">
        <div className="grid justify-items-center gap-3">
          <span>{error.message || errorLabel}</span>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={onRetry}
            type="button"
          >
            <RefreshCw size={16} />
            {retryLabel}
          </button>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="grid flex-1 place-items-center px-4 text-sm text-slate-500">
        {emptyLabel}
      </div>
    )
  }

  return (
    <ul
      aria-label={title}
      className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2"
    >
      {items.map((type) => {
        const isSelected = selectedTypeId === type.id

        return (
          <li key={type.id}>
            <div
              className={`group flex min-h-12 items-center gap-2 rounded-md transition ${
                isSelected
                  ? 'bg-cyan-500 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <button
                aria-current={isSelected ? 'true' : undefined}
                aria-label={`${selectLabel} ${type.code}`}
                className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-md px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-1"
                onClick={() => onSelect(type)}
                onContextMenu={(event) => onContextMenu(event, type)}
                type="button"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {type.name}
                  </span>
                  <span
                    className={`block truncate text-xs ${
                      isSelected ? 'text-cyan-50' : 'text-slate-500'
                    }`}
                  >
                    {type.code}
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  {type.isSystem ? (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] ${
                        isSelected
                          ? 'bg-white/15 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {systemLabel}
                    </span>
                  ) : null}
                  {isSelected ? <Check size={16} /> : null}
                </span>
              </button>
              {canOpenMenu ? (
                <button
                  aria-label={`${editLabel} ${type.code}`}
                  className={`mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-md transition ${
                    isSelected
                      ? 'text-white hover:bg-white/15'
                      : 'text-slate-400 hover:bg-slate-200 hover:text-slate-700'
                  } outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-1`}
                  onClick={(event) => onContextMenu(event, type)}
                  title={`${editLabel} / ${deleteLabel}`}
                  type="button"
                >
                  <MoreHorizontal size={16} />
                </button>
              ) : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function DictionaryTypeContextMenu({
  canDelete,
  canUpdate,
  deleteLabel,
  editLabel,
  isSystem,
  onDelete,
  onEdit,
  onRequestClose,
  x,
  y,
}: {
  canDelete: boolean
  canUpdate: boolean
  deleteLabel: string
  editLabel: string
  isSystem: boolean
  onDelete: () => void
  onEdit: () => void
  onRequestClose: () => void
  x: number
  y: number
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        onRequestClose()
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onRequestClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onRequestClose])

  return (
    <div
      className="fixed z-30 min-w-32 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
      ref={menuRef}
      role="menu"
      style={{
        left: x,
        top: y,
      }}
    >
      {canUpdate ? (
        <button
          className="flex h-9 w-full items-center px-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
          onClick={onEdit}
          role="menuitem"
          type="button"
        >
          {editLabel}
        </button>
      ) : null}
      {canDelete ? (
        <button
          className="flex h-9 w-full items-center px-3 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
          disabled={isSystem}
          onClick={onDelete}
          role="menuitem"
          type="button"
        >
          {deleteLabel}
        </button>
      ) : null}
    </div>
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
