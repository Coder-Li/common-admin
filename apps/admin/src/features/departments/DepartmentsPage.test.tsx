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
  createDepartment,
  deleteDepartment,
  getDepartmentOptions,
  getDepartmentTree,
  getGetDepartmentOptionsQueryKey,
  getGetDepartmentTreeQueryKey,
  getListDepartmentsQueryKey,
  listDepartments,
  updateDepartment,
} from '../../generated/api/endpoints/departments/departments'
import type {
  DepartmentListResponseDto,
  DepartmentOptionDto,
  DepartmentTreeNodeDto,
  UpdateDepartmentDto,
} from '../../generated/api/schemas'
import type { DepartmentRecord } from './departments.types'
import { DepartmentsPage } from './DepartmentsPage'

vi.mock('../../generated/api/endpoints/departments/departments', () => ({
  createDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  getDepartmentOptions: vi.fn(),
  getDepartmentTree: vi.fn(),
  getGetDepartmentOptionsQueryKey: vi.fn((params?: unknown) => [
    '/departments/options',
    ...(params ? [params] : []),
  ]),
  getGetDepartmentTreeQueryKey: vi.fn(() => ['/departments/tree']),
  getListDepartmentsQueryKey: vi.fn((params?: unknown) => [
    '/departments',
    ...(params ? [params] : []),
  ]),
  listDepartments: vi.fn(),
  updateDepartment: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const engineering: DepartmentRecord = {
  id: 'dept-engineering',
  code: 'engineering',
  name: 'Engineering',
  parentId: null,
  parentName: null,
  status: 'ACTIVE',
  sortOrder: 10,
  description: 'Builds product',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T01:00:00.000Z',
}

const platform: DepartmentRecord = {
  id: 'dept-platform',
  code: 'platform',
  name: 'Platform',
  parentId: 'dept-engineering',
  parentName: 'Engineering',
  status: 'ACTIVE',
  sortOrder: 20,
  description: null,
  createdAt: '2026-06-02T00:00:00.000Z',
  updatedAt: '2026-06-02T01:00:00.000Z',
}

const disabledChild: DepartmentRecord = {
  id: 'dept-disabled-child',
  code: 'disabled_child',
  name: 'Disabled Child',
  parentId: 'dept-legacy-ops',
  parentName: 'Legacy Ops',
  status: 'ACTIVE',
  sortOrder: 40,
  description: null,
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T01:00:00.000Z',
}

const apiTeam: DepartmentRecord = {
  id: 'dept-api',
  code: 'api',
  name: 'API',
  parentId: 'dept-platform',
  parentName: 'Platform',
  status: 'ACTIVE',
  sortOrder: 21,
  description: null,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T01:00:00.000Z',
}

const departmentTree: DepartmentTreeNodeDto[] = [
  {
    id: 'dept-engineering',
    code: 'engineering',
    name: 'Engineering',
    parentId: null,
    status: 'ACTIVE',
    sortOrder: 10,
    children: [
      {
        id: 'dept-platform',
        code: 'platform',
        name: 'Platform',
        parentId: 'dept-engineering',
        status: 'ACTIVE',
        sortOrder: 20,
        children: [
          {
            id: 'dept-api',
            code: 'api',
            name: 'API',
            parentId: 'dept-platform',
            status: 'ACTIVE',
            sortOrder: 21,
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'dept-legacy-ops',
    code: 'legacy_ops',
    name: 'Legacy Ops',
    parentId: null,
    status: 'DISABLED',
    sortOrder: 30,
    children: [],
  },
]

const activeOptions: DepartmentOptionDto[] = [
  {
    id: 'dept-engineering',
    code: 'engineering',
    name: 'Engineering',
    parentId: null,
    status: 'ACTIVE',
  },
  {
    id: 'dept-platform',
    code: 'platform',
    name: 'Platform',
    parentId: 'dept-engineering',
    status: 'ACTIVE',
  },
  {
    id: 'dept-api',
    code: 'api',
    name: 'API',
    parentId: 'dept-platform',
    status: 'ACTIVE',
  },
]

const activeWithDisabledParentOptions: DepartmentOptionDto[] = [
  ...activeOptions,
  {
    id: 'dept-legacy-ops',
    code: 'legacy_ops',
    name: 'Legacy Ops',
    parentId: null,
    status: 'DISABLED',
  },
]

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
}

function listResponse(items: DepartmentRecord[]): DepartmentListResponseDto {
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

function renderDepartmentsPage(
  permissions = [
    'department.create',
    'department.update',
    'department.delete',
  ],
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
        <DepartmentsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DepartmentsPage', () => {
  beforeEach(() => {
    vi.mocked(createDepartment).mockReset()
    vi.mocked(deleteDepartment).mockReset()
    vi.mocked(getDepartmentOptions).mockReset()
    vi.mocked(getDepartmentTree).mockReset()
    vi.mocked(getGetDepartmentOptionsQueryKey).mockClear()
    vi.mocked(getGetDepartmentOptionsQueryKey).mockImplementation(
      (params?: unknown) => ['/departments/options', ...(params ? [params] : [])],
    )
    vi.mocked(getGetDepartmentTreeQueryKey).mockClear()
    vi.mocked(getGetDepartmentTreeQueryKey).mockImplementation(() => [
      '/departments/tree',
    ])
    vi.mocked(getListDepartmentsQueryKey).mockClear()
    vi.mocked(getListDepartmentsQueryKey).mockImplementation(
      (params?: unknown) => ['/departments', ...(params ? [params] : [])],
    )
    vi.mocked(listDepartments).mockReset()
    vi.mocked(updateDepartment).mockReset()
    vi.mocked(getDepartmentTree).mockResolvedValue(departmentTree)
    vi.mocked(getDepartmentOptions).mockResolvedValue(activeOptions)
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders the loading state while departments are loading', () => {
    vi.mocked(listDepartments).mockReturnValue(
      deferred<DepartmentListResponseDto>().promise,
    )

    renderDepartmentsPage()

    expect(screen.getByText('Loading departments')).toBeInTheDocument()
  })

  it('renders an empty state when no departments match the query', async () => {
    vi.mocked(listDepartments).mockResolvedValue(listResponse([]))

    renderDepartmentsPage()

    expect(await screen.findByText('No departments found')).toBeInTheDocument()
  })

  it('renders tree and list rows for returned departments', async () => {
    vi.mocked(listDepartments).mockResolvedValue(
      listResponse([engineering, platform, apiTeam]),
    )

    renderDepartmentsPage()

    expect(await screen.findByText('engineering')).toBeInTheDocument()
    expect(screen.getByText('platform')).toBeInTheDocument()
    const platformRow = screen.getByText('platform').closest('tr')
    const apiRow = screen.getByText('api').closest('tr')

    expect(within(platformRow!).getByText('Engineering')).toBeInTheDocument()
    expect(within(apiRow!).getByText('Engineering / Platform')).toBeInTheDocument()
    expect(screen.queryByText('Engineering / Platform / API'))
      .not.toBeInTheDocument()
    expect(screen.getByText('Builds product')).toBeInTheDocument()
  })

  it('queries by search and status filter', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))

    renderDepartmentsPage()
    await screen.findByText('engineering')

    await user.type(screen.getByLabelText('Search departments'), 'eng')
    await user.selectOptions(screen.getByLabelText('Filter by status'), 'ACTIVE')

    await waitFor(() => {
      expect(listDepartments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 20,
          search: 'eng',
          status: 'ACTIVE',
        }),
      )
    })
  })

  it('creates a root department without a parent id', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([]))
    vi.mocked(createDepartment).mockResolvedValue(engineering)

    renderDepartmentsPage()
    await screen.findByText('No departments found')

    await user.click(screen.getByRole('button', { name: 'Create department' }))
    await user.type(screen.getByLabelText('Code'), 'engineering')
    await user.type(screen.getByLabelText('Name'), 'Engineering')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create department',
      }),
    )

    await waitFor(() => {
      expect(createDepartment).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'engineering',
          name: 'Engineering',
          sortOrder: 0,
          status: 'ACTIVE',
        }),
      )
    })
    expect(createDepartment).toHaveBeenCalledWith(
      expect.not.objectContaining({ parentId: expect.any(String) }),
    )
  })

  it('rejects negative sort order and prevents submit', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([]))

    renderDepartmentsPage()
    await screen.findByText('No departments found')

    await user.click(screen.getByRole('button', { name: 'Create department' }))
    await user.type(screen.getByLabelText('Code'), 'engineering')
    await user.type(screen.getByLabelText('Name'), 'Engineering')
    await user.clear(screen.getByLabelText('Sort order'))
    await user.type(screen.getByLabelText('Sort order'), '-1')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create department',
      }),
    )

    expect(
      await screen.findByText('Sort order must be 0 or greater'),
    ).toBeInTheDocument()
    expect(createDepartment).not.toHaveBeenCalled()
  })

  it('creates a child department with the selected parent id', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))
    vi.mocked(createDepartment).mockResolvedValue(platform)

    renderDepartmentsPage()
    await screen.findByText('engineering')

    await user.click(screen.getByRole('button', { name: 'Create department' }))
    await user.type(screen.getByLabelText('Code'), 'platform')
    await user.type(screen.getByLabelText('Name'), 'Platform')
    await user.selectOptions(screen.getByLabelText('Parent department'), [
      'dept-engineering',
    ])
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create department',
      }),
    )

    await waitFor(() => {
      expect(createDepartment).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'platform',
          name: 'Platform',
          parentId: 'dept-engineering',
        }),
      )
    })
  })

  it('submits only changed parentId when parent changes during edit', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([platform]))
    vi.mocked(updateDepartment).mockResolvedValue({
      ...platform,
      parentId: null,
      parentName: null,
    })

    renderDepartmentsPage()
    await screen.findByText('platform')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.selectOptions(screen.getByLabelText('Parent department'), '')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(updateDepartment).toHaveBeenCalledWith(
        'dept-platform',
        expect.objectContaining<UpdateDepartmentDto>({
          parentId: null,
        }),
      )
    })
  })

  it('shows an unchanged disabled parent but omits parentId from update payload', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([disabledChild]))
    vi.mocked(getDepartmentOptions).mockImplementation((params?: unknown) => {
      if (
        params &&
        typeof params === 'object' &&
        'includeIds' in params &&
        params.includeIds === 'dept-legacy-ops'
      ) {
        return Promise.resolve(activeWithDisabledParentOptions)
      }

      return Promise.resolve(activeOptions)
    })
    vi.mocked(updateDepartment).mockResolvedValue(disabledChild)

    renderDepartmentsPage()
    await screen.findByText('disabled_child')

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(getDepartmentOptions).toHaveBeenCalledWith({
        includeIds: 'dept-legacy-ops',
        status: 'ACTIVE',
      })
    })
    expect(screen.getByLabelText('Parent department')).toHaveValue(
      'dept-legacy-ops',
    )
    expect(
      within(screen.getByLabelText('Parent department')).getByRole('option', {
        name: 'Legacy Ops (legacy_ops) - Disabled',
      }),
    ).toBeDisabled()

    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Disabled Child Team')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(updateDepartment).toHaveBeenCalledWith(
        'dept-disabled-child',
        expect.any(Object),
      )
    })
    expect(updateDepartment).toHaveBeenCalledWith(
      'dept-disabled-child',
      expect.not.objectContaining({ parentId: expect.anything() }),
    )
  })

  it('disables the current department and descendants in the parent selector', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))

    renderDepartmentsPage()
    await screen.findByText('engineering')

    await user.click(screen.getByRole('button', { name: 'Edit' }))

    const parentSelect = screen.getByLabelText('Parent department')
    expect(
      within(parentSelect).getByRole('option', {
        name: 'Engineering (engineering) - Current department',
      }),
    ).toBeDisabled()
    expect(
      within(parentSelect).getByRole('option', {
        name: 'Platform (platform) - Descendant',
      }),
    ).toBeDisabled()
  })

  it('prevents changing the parent to a disabled department', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))
    vi.mocked(getDepartmentOptions).mockResolvedValue(
      activeWithDisabledParentOptions,
    )

    renderDepartmentsPage()
    await screen.findByText('engineering')

    await user.click(screen.getByRole('button', { name: 'Create department' }))
    const parentSelect = screen.getByLabelText('Parent department')

    expect(
      within(parentSelect).getByRole('option', {
        name: 'Legacy Ops (legacy_ops) - Disabled',
      }),
    ).toBeDisabled()
    await user.selectOptions(parentSelect, 'dept-legacy-ops')
    expect(parentSelect).toHaveValue('')
  })

  it('confirms delete and calls deleteDepartment', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))
    vi.mocked(deleteDepartment).mockResolvedValue(undefined)

    renderDepartmentsPage()
    await screen.findByText('engineering')

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog', { name: 'Delete department' }))
      .toHaveTextContent('engineering')
    await user.click(screen.getByRole('button', { name: 'Delete department' }))

    await waitFor(() => {
      expect(deleteDepartment).toHaveBeenCalledWith('dept-engineering')
    })
  })

  it('hides create, edit, and delete actions without department permissions', async () => {
    vi.mocked(listDepartments).mockResolvedValue(listResponse([engineering]))

    renderDepartmentsPage([])
    await screen.findByText('engineering')

    expect(
      screen.queryByRole('button', { name: 'Create department' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('renders normalized API errors and toasts mutation failures', async () => {
    const user = userEvent.setup()
    vi.mocked(listDepartments)
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce(listResponse([engineering]))
    vi.mocked(createDepartment).mockRejectedValue(apiError)

    renderDepartmentsPage()

    expect(
      await screen.findByText('Something went wrong. Request ID: req_test123'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('engineering')
    await user.click(screen.getByRole('button', { name: 'Create department' }))
    await user.type(screen.getByLabelText('Code'), 'ops')
    await user.type(screen.getByLabelText('Name'), 'Operations')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create department',
      }),
    )

    const { toast } = await import('sonner')
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Something went wrong. Request ID: req_test123',
      )
    })
  })
})
