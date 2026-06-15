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
import { useAuthStore } from '../../stores/auth-store'
import {
  createPosition,
  deletePosition,
  getListPositionsQueryKey,
  listPositions,
  updatePosition,
} from '../../generated/api/endpoints/positions/positions'
import type {
  PositionListResponseDto,
  UpdatePositionDto,
} from '../../generated/api/schemas'
import type { PositionRecord } from './positions.types'
import { PositionsPage } from './PositionsPage'

vi.mock('../../generated/api/endpoints/positions/positions', () => ({
  createPosition: vi.fn(),
  deletePosition: vi.fn(),
  getListPositionsQueryKey: vi.fn((params?: unknown) => [
    '/positions',
    ...(params ? [params] : []),
  ]),
  listPositions: vi.fn(),
  updatePosition: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const engineeringManager: PositionRecord = {
  id: 'pos-engineering-manager',
  code: 'engineering_manager',
  name: 'Engineering Manager',
  status: 'ACTIVE',
  sortOrder: 10,
  description: 'Leads engineering teams',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T01:00:00.000Z',
}

const supportSpecialist: PositionRecord = {
  id: 'pos-support-specialist',
  code: 'support_specialist',
  name: 'Support Specialist',
  status: 'DISABLED',
  sortOrder: 20,
  description: null,
  createdAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T01:00:00.000Z',
}

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_position123',
}

function listResponse(items: PositionRecord[], total = items.length) {
  return {
    items,
    page: 1,
    pageSize: 20,
    total,
  } satisfies PositionListResponseDto
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

function renderPositionsPage(
  permissions = ['position.create', 'position.update', 'position.delete'],
) {
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
        <PositionsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('PositionsPage', () => {
  beforeEach(() => {
    vi.mocked(createPosition).mockReset()
    vi.mocked(deletePosition).mockReset()
    vi.mocked(getListPositionsQueryKey).mockClear()
    vi.mocked(getListPositionsQueryKey).mockImplementation(
      (params?: unknown) => ['/positions', ...(params ? [params] : [])],
    )
    vi.mocked(listPositions).mockReset()
    vi.mocked(updatePosition).mockReset()
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders the loading state while positions are loading', () => {
    vi.mocked(listPositions).mockReturnValue(
      deferred<PositionListResponseDto>().promise,
    )

    renderPositionsPage()

    expect(screen.getByText('Loading positions')).toBeInTheDocument()
  })

  it('renders an empty state when no positions match the query', async () => {
    vi.mocked(listPositions).mockResolvedValue(listResponse([]))

    renderPositionsPage()

    expect(await screen.findByText('No positions found')).toBeInTheDocument()
  })

  it('renders returned position rows', async () => {
    vi.mocked(listPositions).mockResolvedValue(
      listResponse([engineeringManager, supportSpecialist]),
    )

    renderPositionsPage()

    expect(await screen.findByText('engineering_manager')).toBeInTheDocument()
    expect(screen.getByText('support_specialist')).toBeInTheDocument()
    const supportRow = screen.getByText('support_specialist').closest('tr')

    expect(screen.getByText('Engineering Manager')).toBeInTheDocument()
    expect(screen.getByText('Leads engineering teams')).toBeInTheDocument()
    expect(within(supportRow!).getByText('Disabled')).toBeInTheDocument()
  })

  it('queries by search, status filter, pagination, and sorting', async () => {
    const user = userEvent.setup()
    vi.mocked(listPositions).mockResolvedValue(
      listResponse([engineeringManager], 40),
    )

    renderPositionsPage()
    await screen.findByText('engineering_manager')

    await user.type(screen.getByLabelText('Search positions'), 'eng')
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'ACTIVE')
    await user.click(screen.getByRole('button', { name: 'Name' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('button', { name: '50' }))

    await waitFor(() => {
      expect(listPositions).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 50,
          search: 'eng',
          sort: 'name:asc',
          status: 'ACTIVE',
        }),
      )
    })
  })

  it('creates a position', async () => {
    const user = userEvent.setup()
    vi.mocked(listPositions).mockResolvedValue(listResponse([]))
    vi.mocked(createPosition).mockResolvedValue(engineeringManager)

    renderPositionsPage()
    await screen.findByText('No positions found')

    await user.click(screen.getByRole('button', { name: 'Create position' }))
    await user.type(screen.getByLabelText('Code'), 'engineering_manager')
    await user.type(screen.getByLabelText('Name'), 'Engineering Manager')
    await user.type(screen.getByLabelText('Description'), 'Leads teams')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create position',
      }),
    )

    await waitFor(() => {
      expect(createPosition).toHaveBeenCalledWith({
        code: 'engineering_manager',
        name: 'Engineering Manager',
        status: 'ACTIVE',
        sortOrder: 0,
        description: 'Leads teams',
      })
    })
  })

  it('rejects negative sort order and prevents submit', async () => {
    const user = userEvent.setup()
    vi.mocked(listPositions).mockResolvedValue(listResponse([]))

    renderPositionsPage()
    await screen.findByText('No positions found')

    await user.click(screen.getByRole('button', { name: 'Create position' }))
    await user.type(screen.getByLabelText('Code'), 'engineering_manager')
    await user.type(screen.getByLabelText('Name'), 'Engineering Manager')
    await user.clear(screen.getByLabelText('Sort order'))
    await user.type(screen.getByLabelText('Sort order'), '-1')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create position',
      }),
    )

    expect(
      await screen.findByText('Sort order must be 0 or greater'),
    ).toBeInTheDocument()
    expect(createPosition).not.toHaveBeenCalled()
  })

  it('edits a position', async () => {
    const user = userEvent.setup()
    vi.mocked(listPositions).mockResolvedValue(listResponse([supportSpecialist]))
    vi.mocked(updatePosition).mockResolvedValue({
      ...supportSpecialist,
      status: 'ACTIVE',
    })

    renderPositionsPage()
    await screen.findByText('support_specialist')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Customer Support Specialist')
    await user.selectOptions(within(dialog).getByLabelText('Status'), 'ACTIVE')
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(updatePosition).toHaveBeenCalledWith(
        'pos-support-specialist',
        expect.objectContaining<UpdatePositionDto>({
          code: 'support_specialist',
          name: 'Customer Support Specialist',
          status: 'ACTIVE',
          sortOrder: 20,
          description: null,
        }),
      )
    })
  })

  it('confirms delete and calls deletePosition', async () => {
    const user = userEvent.setup()
    vi.mocked(listPositions).mockResolvedValue(listResponse([engineeringManager]))
    vi.mocked(deletePosition).mockResolvedValue(undefined)

    renderPositionsPage()
    await screen.findByText('engineering_manager')

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog', { name: 'Delete position' }))
      .toHaveTextContent('engineering_manager')
    await user.click(screen.getByRole('button', { name: 'Delete position' }))

    await waitFor(() => {
      expect(deletePosition).toHaveBeenCalledWith('pos-engineering-manager')
    })
  })

  it('hides create, edit, and delete actions without position permissions', async () => {
    vi.mocked(listPositions).mockResolvedValue(listResponse([engineeringManager]))

    renderPositionsPage([])
    await screen.findByText('engineering_manager')

    expect(
      screen.queryByRole('button', { name: 'Create position' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('renders normalized API errors and toasts mutation failures', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    vi.mocked(listPositions)
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce(listResponse([engineeringManager]))
    vi.mocked(createPosition).mockRejectedValue(apiError)

    renderPositionsPage()

    expect(
      await screen.findByText('Something went wrong. Request ID: req_position123'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('engineering_manager')
    await user.click(screen.getByRole('button', { name: 'Create position' }))
    await user.type(screen.getByLabelText('Code'), 'ops_lead')
    await user.type(screen.getByLabelText('Name'), 'Operations Lead')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create position',
      }),
    )

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Request ID: req_position123',
      )
    })
  })
})
