import { useMemo, useState } from 'react'
import type { OnChangeFn } from '@tanstack/react-table'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { getErrorMessage } from '../../app/api-error-messages'
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
import {
  deleteFile,
  downloadFile,
  getFile,
  listFiles,
  updateFile,
  uploadFile,
} from '../../generated/api/endpoints/files/files'
import {
  getGetUploadSettingsQueryKey,
  getUploadSettings,
} from '../../generated/api/endpoints/settings/settings'
import type { ListFilesParams } from '../../generated/api/schemas'
import { FileForm } from './FileForm'
import { FileUploadDialog } from './FileUploadDialog'
import { createFileColumns } from './files.columns'
import type { FileListQuery, FileRecord, UpdateFileRequest } from './files.types'

type FileTableQuery = FileListQuery & {
  page: number
  pageSize: number
}

function toSortParam(sorting: SortingState) {
  const firstSort = sorting[0]

  if (!firstSort) {
    return undefined
  }

  return `${firstSort.id}:${firstSort.desc ? 'desc' : 'asc'}`
}

function downloadName(file: FileRecord) {
  if (!file.extension || /\.[^./\\]+$/.test(file.displayName)) {
    return file.displayName
  }

  return `${file.displayName}.${file.extension}`
}

export function FilesPage() {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const permissions = useAuthStore((state) => state.permissions)
  const [search, setSearch] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })
  const [sorting, setSorting] = useState<SortingState>([])
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<FileRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<FileRecord | null>(null)
  const canUpload = can(permissions, 'file.upload')
  const canUpdate = can(permissions, 'file.update')
  const canDelete = can(permissions, 'file.delete')
  const canDownload = can(permissions, 'file.download')

  const filesQuery = useServerTableQuery<FileRecord, object, FileTableQuery>({
    resource: 'files',
    state: {
      filters: {},
      pageIndex: pagination.pageIndex,
      pageSize: pagination.pageSize,
      search,
      sort: toSortParam(sorting),
    },
    queryFn: (query) => listFiles(query as unknown as ListFilesParams),
  })
  const uploadSettingsQuery = useQuery({
    queryKey: getGetUploadSettingsQueryKey(),
    queryFn: ({ signal }) => getUploadSettings(undefined, signal),
    retry: false,
  })

  const invalidateFiles = () =>
    queryClient.invalidateQueries({
      queryKey: ['files', 'list'],
    })

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => uploadFile(formData),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('files.error.upload'), t))
    },
    onSuccess: async () => {
      toast.success(t('files.success.upload'))
      setIsUploadOpen(false)
      await invalidateFiles()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string; value: UpdateFileRequest }) =>
      updateFile(payload.id, payload.value),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('files.error.update'), t))
    },
    onSuccess: async () => {
      toast.success(t('files.success.update'))
      setEditTarget(null)
      await invalidateFiles()
    },
  })

  const editMutation = useMutation({
    mutationFn: (id: string) => getFile(id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('files.error.load'), t))
    },
    onSuccess: (file) => {
      setEditTarget(file)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFile(id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('files.delete.error'), t))
    },
    onSuccess: async () => {
      toast.success(t('files.delete.success'))
      setDeleteTarget(null)
      await invalidateFiles()
    },
  })

  const downloadMutation = useMutation({
    mutationFn: (file: FileRecord) => downloadFile(file.id),
    onError: (error) => {
      toast.error(getErrorMessage(error, t('files.error.download'), t))
    },
    onSuccess: (blob, file) => {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = downloadName(file)
      anchor.click()
      URL.revokeObjectURL(url)
    },
  })

  const columns = useMemo(
    () =>
      createFileColumns(
        {
          actions: t('files.column.actions'),
          createdAt: t('files.column.createdAt'),
          delete: t('files.action.delete'),
          displayName: t('files.column.displayName'),
          download: t('files.action.download'),
          edit: t('files.action.edit'),
          mimeType: t('files.column.mimeType'),
          size: t('files.column.size'),
          storageDriver: t('files.column.storageDriver'),
        },
        {
          canDelete,
          canDownload,
          canUpdate,
          onDelete: setDeleteTarget,
          onDownload: (file) => downloadMutation.mutate(file),
          onEdit: (file) => editMutation.mutate(file.id),
        },
      ),
    [canDelete, canDownload, canUpdate, downloadMutation, editMutation, t],
  )

  const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
    setPagination((currentPagination) =>
      typeof updater === 'function' ? updater(currentPagination) : updater,
    )
  }

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
    setSorting((currentSorting) =>
      typeof updater === 'function' ? updater(currentSorting) : updater,
    )
  }

  function handleSearchChange(value: string) {
    setSearch(value)
    setPagination((currentPagination) => ({
      ...currentPagination,
      pageIndex: 0,
    }))
  }

  return (
    <section className="grid gap-4 p-5">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          {t('files.title')}
        </h2>
        {canUpload ? (
          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-cyan-500 px-3 text-sm font-medium text-white transition hover:bg-cyan-600"
            onClick={() => setIsUploadOpen(true)}
            type="button"
          >
            <Upload size={16} />
            {t('files.action.upload')}
          </button>
        ) : null}
      </div>

      <DataTable
        columns={columns}
        data={filesQuery.data?.items ?? []}
        emptyLabel={t('files.state.empty')}
        error={filesQuery.error}
        errorLabel={t('files.error.load')}
        formatError={(error, fallback) => getErrorMessage(error, fallback, t)}
        isLoading={filesQuery.isLoading}
        loadingLabel={t('files.state.loading')}
        onPaginationChange={handlePaginationChange}
        onRetry={() => filesQuery.refetch()}
        onSortingChange={handleSortingChange}
        pagination={pagination}
        retryLabel={t('files.state.retry')}
        sorting={sorting}
        toolbar={
          <DataTableToolbar
            onSearchChange={handleSearchChange}
            searchLabel={t('files.searchPlaceholder')}
            searchPlaceholder={t('files.searchPlaceholder')}
            searchValue={search}
          />
        }
        total={filesQuery.data?.total ?? 0}
      />

      {isUploadOpen ? (
        <Modal title={t('files.action.upload')}>
          <FileUploadDialog
            isSubmitting={uploadMutation.isPending}
            onCancel={() => setIsUploadOpen(false)}
            policy={
              uploadSettingsQuery.data
                ? {
                    maxSizeMb: uploadSettingsQuery.data.maxSizeMb,
                    allowedMimeTypes: uploadSettingsQuery.data.allowedMimeTypes,
                  }
                : undefined
            }
            onSubmit={(formData) => uploadMutation.mutate(formData)}
          />
        </Modal>
      ) : null}

      {editTarget ? (
        <Modal title={t('files.action.edit')}>
          <FileForm
            initialValue={editTarget}
            isSubmitting={updateMutation.isPending}
            onCancel={() => setEditTarget(null)}
            onSubmit={(value) =>
              updateMutation.mutate({ id: editTarget.id, value })
            }
          />
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title={t('files.delete.confirmTitle')} widthClassName="max-w-sm">
          <p className="text-sm text-slate-600">{deleteTarget.displayName}</p>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              disabled={deleteMutation.isPending}
              onClick={() => setDeleteTarget(null)}
              type="button"
            >
              {t('files.form.cancel')}
            </button>
            <button
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              type="button"
            >
              {t('files.delete.confirmTitle')}
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
  children: React.ReactNode
  title: string
  widthClassName?: string
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-20 grid place-items-center bg-slate-950/40 p-4"
      role="dialog"
    >
      <div
        className={`w-full rounded-lg border border-slate-200 bg-white p-5 shadow-xl ${widthClassName}`}
      >
        <h3 className="mb-4 text-base font-semibold text-slate-950">{title}</h3>
        {children}
      </div>
    </div>
  )
}
