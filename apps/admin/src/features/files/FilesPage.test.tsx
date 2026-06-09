// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import type {
  FileListQuery,
  FileListResponse,
  FileRecord,
  UpdateFileRequest,
} from './files.types'
import { FilesPage } from './FilesPage'

const filesApiMock = vi.hoisted(() => ({
  deleteFile: vi.fn(),
  downloadFile: vi.fn(),
  listFiles: vi.fn(),
  updateFile: vi.fn(),
  uploadFile: vi.fn(),
}))

vi.mock('./files.api', () => filesApiMock)

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const report: FileRecord = {
  id: 'file-1',
  originalName: 'report.pdf',
  displayName: 'Report',
  mimeType: 'application/pdf',
  extension: 'pdf',
  size: '2048',
  storageDriver: 'LOCAL',
  visibility: 'PRIVATE',
  description: 'Quarterly report',
  metadata: null,
  uploadedById: 'user-1',
  createdAt: '2026-06-09T01:02:03.000Z',
  updatedAt: '2026-06-09T04:05:06.000Z',
}

function listResponse(items: FileRecord[]): FileListResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })

  return { promise, reject, resolve }
}

function renderFilesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <FilesPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('FilesPage', () => {
  beforeEach(() => {
    filesApiMock.deleteFile.mockReset()
    filesApiMock.downloadFile.mockReset()
    filesApiMock.listFiles.mockReset()
    filesApiMock.updateFile.mockReset()
    filesApiMock.uploadFile.mockReset()
    URL.createObjectURL = vi.fn(() => 'blob:download-url')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the loading state while files are loading', () => {
    filesApiMock.listFiles.mockReturnValue(deferred<FileListResponse>().promise)

    renderFilesPage()

    expect(screen.getByText('Loading files')).toBeInTheDocument()
  })

  it('renders an empty state when no files match the query', async () => {
    filesApiMock.listFiles.mockResolvedValue(listResponse([]))

    renderFilesPage()

    expect(await screen.findByText('No files found')).toBeInTheDocument()
  })

  it('renders an error state with retry', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles
      .mockRejectedValueOnce(new Error('Files are unavailable'))
      .mockResolvedValueOnce(listResponse([report]))

    renderFilesPage()

    expect(await screen.findByText('Files are unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Report')).toBeInTheDocument()
    expect(filesApiMock.listFiles).toHaveBeenCalledTimes(2)
  })

  it('renders returned file records', async () => {
    filesApiMock.listFiles.mockResolvedValue(listResponse([report]))

    renderFilesPage()

    expect(await screen.findByText('Report')).toBeInTheDocument()
    expect(screen.getByText('application/pdf')).toBeInTheDocument()
    expect(screen.getByText('2 KB')).toBeInTheDocument()
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
  })

  it('queries the list again when search changes', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles.mockResolvedValue(listResponse([report]))

    renderFilesPage()
    await screen.findByText('Report')

    await user.type(screen.getByLabelText('Search files'), 'report')

    await waitFor(() => {
      expect(filesApiMock.listFiles).toHaveBeenLastCalledWith(
        expect.objectContaining<FileListQuery>({
          page: 1,
          pageSize: 20,
          search: 'report',
        }),
      )
    })
  })

  it('invalidates the file list and closes the upload dialog after upload succeeds', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles.mockResolvedValue(listResponse([]))
    filesApiMock.uploadFile.mockResolvedValue(report)

    renderFilesPage()
    await screen.findByText('No files found')

    await user.click(screen.getByRole('button', { name: 'Upload file' }))
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' })
    await user.upload(screen.getByLabelText('File'), file)
    await user.type(screen.getByLabelText('Display name'), 'Hello')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Upload file',
      }),
    )

    await waitFor(() => {
      expect(filesApiMock.uploadFile).toHaveBeenCalledWith(expect.any(FormData))
    })
    await waitFor(() => expect(filesApiMock.listFiles).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('invalidates the file list after edit succeeds', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles.mockResolvedValue(listResponse([report]))
    filesApiMock.updateFile.mockResolvedValue({
      ...report,
      displayName: 'Updated report',
    })

    renderFilesPage()
    await screen.findByText('Report')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Updated report')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }),
    )

    await waitFor(() => {
      expect(filesApiMock.updateFile).toHaveBeenCalledWith(
        'file-1',
        expect.objectContaining<UpdateFileRequest>({
          displayName: 'Updated report',
        }),
      )
    })
    await waitFor(() => expect(filesApiMock.listFiles).toHaveBeenCalledTimes(2))
  })

  it('invalidates the file list after delete succeeds', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles.mockResolvedValue(listResponse([report]))
    filesApiMock.deleteFile.mockResolvedValue(undefined)

    renderFilesPage()
    await screen.findByText('Report')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete file' }))

    await waitFor(() => {
      expect(filesApiMock.deleteFile).toHaveBeenCalledWith('file-1')
    })
    await waitFor(() => expect(filesApiMock.listFiles).toHaveBeenCalledTimes(2))
  })

  it('downloads files with an object URL and temporary anchor', async () => {
    const user = userEvent.setup()
    filesApiMock.listFiles.mockResolvedValue(listResponse([report]))
    filesApiMock.downloadFile.mockResolvedValue(
      new Blob(['hello'], { type: 'application/pdf' }),
    )
    const click = vi.fn()
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const element = originalCreateElement(tagName)
      if (tagName === 'a') {
        element.click = click
      }
      return element
    })

    renderFilesPage()
    await screen.findByText('Report')

    await user.click(screen.getByRole('button', { name: 'Download' }))

    await waitFor(() => {
      expect(filesApiMock.downloadFile).toHaveBeenCalledWith('file-1')
    })
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download-url')
  })
})
