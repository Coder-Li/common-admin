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
import { LOCALE_STORAGE_KEY } from '../../i18n/locale-storage'
import { useAuthStore } from '../../stores/auth-store'
import type {
  AuditLogListQuery,
  AuditLogListResponse,
  AuditLogRecord,
} from './audit-logs.types'
import { AuditLogsPage } from './AuditLogsPage'

const auditLogsApiMock = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  listAuditLogs: vi.fn(),
}))

vi.mock(
  '../../generated/api/endpoints/audit-logs/audit-logs',
  () => auditLogsApiMock,
)

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

const auditLog: AuditLogRecord = {
  id: 'audit-log-1',
  actorUserId: 'user-1',
  actorEmail: 'admin@example.com',
  actorName: 'Admin User',
  action: 'user.update',
  resourceType: 'user',
  resourceId: 'target-user-1',
  ipAddress: '127.0.0.1',
  userAgent: 'Vitest Browser',
  before: {
    status: 'inactive',
  },
  after: {
    status: 'active',
  },
  metadata: {
    requestId: 'request-1',
  },
  createdAt: '2026-06-09T01:02:03.000Z',
}

function listResponse(items: AuditLogRecord[]): AuditLogListResponse {
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

function renderAuditLogsPage(permissions = ['audit_log.read']) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user: {
      id: 'current-user',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions,
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuditLogsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('AuditLogsPage', () => {
  beforeEach(() => {
    auditLogsApiMock.getAuditLog.mockReset()
    auditLogsApiMock.listAuditLogs.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders the loading state while audit logs are loading', () => {
    auditLogsApiMock.listAuditLogs.mockReturnValue(
      deferred<AuditLogListResponse>().promise,
    )

    renderAuditLogsPage()

    expect(screen.getByText('Loading audit logs...')).toBeInTheDocument()
  })

  it('renders an empty state when no audit logs match the query', async () => {
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([]))

    renderAuditLogsPage()

    expect(await screen.findByText('No audit logs found')).toBeInTheDocument()
  })

  it('renders an error state with retry', async () => {
    const user = userEvent.setup()
    auditLogsApiMock.listAuditLogs
      .mockRejectedValueOnce(new Error('Audit logs are unavailable'))
      .mockResolvedValueOnce(listResponse([auditLog]))

    renderAuditLogsPage()

    expect(
      await screen.findByText('Audit logs are unavailable'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument()
    expect(auditLogsApiMock.listAuditLogs).toHaveBeenCalledTimes(2)
  })

  it('renders returned audit log rows', async () => {
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))

    renderAuditLogsPage()

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(screen.getByText('user.update')).toBeInTheDocument()
    expect(within(table).getByText('user')).toBeInTheDocument()
    expect(screen.getByText('target-user-1')).toBeInTheDocument()
    expect(screen.getByText('127.0.0.1')).toBeInTheDocument()
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
  })

  it('queries the list again when search changes', async () => {
    const user = userEvent.setup()
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))

    renderAuditLogsPage()
    await screen.findByText('admin@example.com')

    await user.type(screen.getByLabelText('Search actor or resource ID'), 'admin')

    await waitFor(() => {
      expect(auditLogsApiMock.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining<AuditLogListQuery>({
          page: 1,
          pageSize: 20,
          search: 'admin',
        }),
      )
    })
  })

  it('sorts only by an allowed backend field', async () => {
    const user = userEvent.setup()
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))

    renderAuditLogsPage()
    await screen.findByText('admin@example.com')

    await user.click(screen.getByRole('button', { name: 'Time' }))

    await waitFor(() => {
      expect(auditLogsApiMock.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining<AuditLogListQuery>({
          page: 1,
          pageSize: 20,
          sort: 'createdAt:asc',
        }),
      )
    })
    expect(screen.queryByRole('button', { name: 'Resource ID' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Actions' })).toBeNull()
  })

  it('queries the list again when filters change', async () => {
    const user = userEvent.setup()
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))

    renderAuditLogsPage()
    await screen.findByText('admin@example.com')

    await user.selectOptions(screen.getByLabelText('Action'), 'update')

    await waitFor(() => {
      expect(auditLogsApiMock.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining<AuditLogListQuery>({
          action: 'update',
          page: 1,
          pageSize: 20,
        }),
      )
    })

    await user.selectOptions(screen.getByLabelText('Resource'), 'user')

    await waitFor(() => {
      expect(auditLogsApiMock.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining<AuditLogListQuery>({
          action: 'update',
          page: 1,
          pageSize: 20,
          resourceType: 'user',
        }),
      )
    })

    await user.type(screen.getByLabelText('From'), '2026-06-01')
    await user.type(screen.getByLabelText('To'), '2026-06-09')

    await waitFor(() => {
      expect(auditLogsApiMock.listAuditLogs).toHaveBeenLastCalledWith(
        expect.objectContaining<AuditLogListQuery>({
          action: 'update',
          dateFrom: '2026-06-01',
          dateTo: '2026-06-09',
          page: 1,
          pageSize: 20,
          resourceType: 'user',
        }),
      )
    })
  })

  it('loads and renders audit log details', async () => {
    const user = userEvent.setup()
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))
    auditLogsApiMock.getAuditLog.mockResolvedValue(auditLog)

    renderAuditLogsPage()
    await screen.findByText('admin@example.com')

    await user.click(screen.getByRole('button', { name: 'View details' }))

    expect(auditLogsApiMock.getAuditLog).toHaveBeenCalledWith('audit-log-1')
    const dialog = await screen.findByRole('dialog', {
      name: 'Audit log details',
    })
    expect(within(dialog).getByText('Admin User')).toBeInTheDocument()
    expect(within(dialog).getByText('Vitest Browser')).toBeInTheDocument()
    expect(within(dialog).getByText('Before')).toBeInTheDocument()
    expect(within(dialog).getByText('After')).toBeInTheDocument()
    expect(within(dialog).getByText('Metadata')).toBeInTheDocument()
    expect(within(dialog).getByText(/"status": "inactive"/)).toBeInTheDocument()
    expect(within(dialog).getByText(/"status": "active"/)).toBeInTheDocument()
    expect(within(dialog).getByText(/"requestId": "request-1"/)).toBeInTheDocument()
  })

  it('renders localized Chinese audit log details labels', async () => {
    const user = userEvent.setup()
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN')
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))
    auditLogsApiMock.getAuditLog.mockResolvedValue(auditLog)

    renderAuditLogsPage()
    await screen.findByText('admin@example.com')

    await user.click(screen.getByRole('button', { name: '查看详情' }))

    const dialog = await screen.findByRole('dialog', {
      name: '审计日志详情',
    })
    expect(
      within(dialog).getByRole('button', { name: '关闭' }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('时间')).toBeInTheDocument()
    expect(within(dialog).getByText('操作者')).toBeInTheDocument()
    expect(within(dialog).getByText('动作')).toBeInTheDocument()
    expect(within(dialog).getByText('资源')).toBeInTheDocument()
    expect(within(dialog).getByText('资源 ID')).toBeInTheDocument()
    expect(within(dialog).getByText('IP')).toBeInTheDocument()
    expect(within(dialog).getByText('用户代理')).toBeInTheDocument()
    expect(within(dialog).getByText('之前')).toBeInTheDocument()
    expect(within(dialog).getByText('之后')).toBeInTheDocument()
    expect(within(dialog).getByText('元数据')).toBeInTheDocument()
  })

  it('does not render create, edit, or delete controls', async () => {
    auditLogsApiMock.listAuditLogs.mockResolvedValue(listResponse([auditLog]))

    renderAuditLogsPage([
      'audit_log.read',
      'audit_log.create',
      'audit_log.update',
      'audit_log.delete',
    ])
    await screen.findByText('admin@example.com')

    expect(screen.queryByRole('button', { name: /create/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /edit/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })
})
