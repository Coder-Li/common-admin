// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryHistory } from '@tanstack/react-router'
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
import { clearQueryCache } from '../../app/query-client'
import { I18nProvider } from '../../i18n/I18nProvider'
import { AdminRouterProvider } from '../../routes/router'
import { createAdminRouter } from '../../routes/router-factory'
import { useAuthStore } from '../../stores/auth-store'
import { ThemeProvider } from '../../theme/ThemeProvider'
import {
  getListRolesQueryKey,
  listRoles,
} from '../../generated/api/endpoints/roles/roles'
import {
  getDepartmentOptions,
  getGetDepartmentOptionsQueryKey,
} from '../../generated/api/endpoints/departments/departments'
import {
  getGetPositionOptionsQueryKey,
  getPositionOptions,
} from '../../generated/api/endpoints/positions/positions'
import {
  createUser,
  deleteUser,
  getListUsersQueryKey,
  listUsers,
  replaceUserRoles,
  resetUserPassword,
  updateUser,
} from '../../generated/api/endpoints/users/users'
import type {
  CreateUserRequest,
  ListUsersParams,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserRecord,
} from './users.types'
import type {
  DepartmentOptionDto,
  GetDepartmentOptionsParams,
  GetPositionOptionsParams,
  ListRolesParams,
  PositionOptionDto,
} from '../../generated/api/schemas'
import { UsersPage } from './UsersPage'

vi.mock('../../generated/api/endpoints/roles/roles', () => ({
  getListRolesQueryKey: vi.fn((params?: ListRolesParams) =>
    params ? ['/roles', params] : ['/roles'],
  ),
  listRoles: vi.fn(),
}))

vi.mock('../../generated/api/endpoints/users/users', () => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  getListUsersQueryKey: vi.fn((params?: ListUsersParams) =>
    params ? ['/users', params] : ['/users'],
  ),
  listUsers: vi.fn(),
  replaceUserRoles: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
}))

vi.mock('../../generated/api/endpoints/departments/departments', () => ({
  getDepartmentOptions: vi.fn(),
  getGetDepartmentOptionsQueryKey: vi.fn(
    (params?: GetDepartmentOptionsParams) =>
      params ? ['/departments/options', params] : ['/departments/options'],
  ),
}))

vi.mock('../../generated/api/endpoints/positions/positions', () => ({
  getGetPositionOptionsQueryKey: vi.fn((params?: GetPositionOptionsParams) =>
    params ? ['/positions/options', params] : ['/positions/options'],
  ),
  getPositionOptions: vi.fn(),
}))

vi.mock('../../app/query-client', () => ({
  clearQueryCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const alice: UserRecord = {
  id: 'user-1',
  email: 'alice@example.com',
  username: 'alice',
  firstName: 'Alice',
  lastName: 'Admin',
  roles: [{ code: 'admin', name: 'Administrator' }],
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
}

const bruno: UserRecord = {
  id: 'user-2',
  email: 'bruno@example.com',
  username: 'bruno',
  firstName: 'Bruno',
  lastName: 'Builder',
  roles: [{ code: 'standard', name: 'Team member' }],
  createdAt: '2026-01-03T03:04:05.000Z',
  updatedAt: '2026-01-03T03:04:05.000Z',
}

const engineering = {
  id: 'dept-engineering',
  code: 'ENG',
  name: 'Engineering',
  status: 'ACTIVE',
}

const platform = {
  id: 'dept-platform',
  code: 'PLAT',
  name: 'Platform',
  status: 'ACTIVE',
}

const support = {
  id: 'dept-support',
  code: 'SUP',
  name: 'Support',
  status: 'ACTIVE',
}

const disabledOps = {
  id: 'dept-ops',
  code: 'OPS',
  name: 'Operations',
  status: 'DISABLED',
}

const engineerPosition = {
  id: 'position-engineer',
  code: 'ENG',
  name: 'Engineer',
  status: 'ACTIVE',
}

const leadPosition = {
  id: 'position-lead',
  code: 'LEAD',
  name: 'Lead',
  status: 'ACTIVE',
}

const disabledAdvisorPosition = {
  id: 'position-advisor',
  code: 'ADV',
  name: 'Advisor',
  status: 'DISABLED',
}

const aliceWithOrganization: UserRecord = {
  ...alice,
  departments: [engineering, disabledOps],
  primaryDepartment: engineering,
  positions: [engineerPosition, disabledAdvisorPosition],
}

const aliceWithPrimaryDepartmentOnly: UserRecord = {
  ...alice,
  departments: [engineering],
  primaryDepartment: engineering,
  positions: [],
}

const brunoWithOrganization: UserRecord = {
  ...bruno,
  departments: [],
  primaryDepartment: null,
  positions: [leadPosition],
}

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
}

function listResponse(items: UserRecord[]): UserListResponse {
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

const roleOptions = [
  {
    id: 'role-admin',
    code: 'admin',
    name: 'Administrator',
    description: null,
    status: 'ACTIVE' as const,
    isSystem: true,
    isDefault: false,
    permissions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-standard',
    code: 'standard',
    name: 'Team member',
    description: null,
    status: 'ACTIVE' as const,
    isSystem: true,
    isDefault: true,
    permissions: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

const departmentOptions: DepartmentOptionDto[] = [
  engineering,
  platform,
  support,
]

const departmentOptionsWithDisabled: DepartmentOptionDto[] = [
  ...departmentOptions,
  disabledOps,
]

const positionOptions: PositionOptionDto[] = [
  engineerPosition,
  leadPosition,
]

const positionOptionsWithDisabled: PositionOptionDto[] = [
  ...positionOptions,
  disabledAdvisorPosition,
]

function renderUsersPage(
  permissions = [
    'user.create',
    'user.update',
    'user.delete',
    'user.assign_roles',
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
        <UsersPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

function renderUsersRoute(
  currentUser: UserRecord,
  permissions = [
    'user.read',
    'user.create',
    'user.update',
    'user.delete',
    'user.assign_roles',
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
      id: currentUser.id,
      email: currentUser.email,
      username: currentUser.username,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions,
    },
  })

  const router = createAdminRouter({
    history: createMemoryHistory({ initialEntries: ['/users'] }),
  })

  return {
    router,
    ...render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <I18nProvider>
            <AdminRouterProvider router={router} />
          </I18nProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    ),
  }
}

describe('UsersPage', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn()
    window.localStorage.clear()
    vi.mocked(clearQueryCache).mockReset()
    vi.mocked(createUser).mockReset()
    vi.mocked(deleteUser).mockReset()
    vi.mocked(getListUsersQueryKey).mockClear()
    vi.mocked(getListUsersQueryKey).mockImplementation(
      (params?: ListUsersParams) => (params ? ['/users', params] : ['/users']),
    )
    vi.mocked(listUsers).mockReset()
    vi.mocked(replaceUserRoles).mockReset()
    vi.mocked(resetUserPassword).mockReset()
    vi.mocked(updateUser).mockReset()
    vi.mocked(getListRolesQueryKey).mockClear()
    vi.mocked(getListRolesQueryKey).mockImplementation(
      (params?: ListRolesParams) => (params ? ['/roles', params] : ['/roles']),
    )
    vi.mocked(listRoles).mockReset()
    vi.mocked(listRoles).mockResolvedValue({
      items: roleOptions,
      page: 1,
      pageSize: 100,
      total: roleOptions.length,
    })
    vi.mocked(getDepartmentOptions).mockReset()
    vi.mocked(getDepartmentOptions).mockResolvedValue(departmentOptions)
    vi.mocked(getGetDepartmentOptionsQueryKey).mockClear()
    vi.mocked(getGetDepartmentOptionsQueryKey).mockImplementation(
      (params?: GetDepartmentOptionsParams) =>
        params ? ['/departments/options', params] : ['/departments/options'],
    )
    vi.mocked(getPositionOptions).mockReset()
    vi.mocked(getPositionOptions).mockResolvedValue(positionOptions)
    vi.mocked(getGetPositionOptionsQueryKey).mockClear()
    vi.mocked(getGetPositionOptionsQueryKey).mockImplementation(
      (params?: GetPositionOptionsParams) =>
        params ? ['/positions/options', params] : ['/positions/options'],
    )
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders the loading state while users are loading', () => {
    vi.mocked(listUsers).mockReturnValue(deferred<UserListResponse>().promise)

    renderUsersPage()

    expect(screen.getByText('Loading users')).toBeInTheDocument()
  })

  it('renders an empty state when no users match the query', async () => {
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))

    renderUsersPage()

    expect(await screen.findByText('No users found')).toBeInTheDocument()
  })

  it('renders returned data rows', async () => {
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice, bruno]))

    renderUsersPage()

    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bruno Builder')).toBeInTheDocument()
  })

  it('renders table role labels from role records', async () => {
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice, bruno]))

    renderUsersPage()

    expect((await screen.findAllByText('Administrator')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Team member').length).toBeGreaterThan(0)
  })

  it('renders role records in the role filter while keeping all roles', async () => {
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))

    renderUsersPage()
    await screen.findByText('No users found')

    const roleFilter = screen.getByLabelText('Filter by role')
    expect(
      Array.from(roleFilter.querySelectorAll('option')).map((option) => ({
        label: option.textContent,
        value: option.value,
      })),
    ).toEqual([
      { label: 'All', value: 'ALL' },
      { label: 'Administrator', value: 'admin' },
      { label: 'Team member', value: 'standard' },
    ])
  })

  it('renders role records in the role select', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))

    const roleSelect = within(screen.getByRole('dialog')).getByLabelText('Role')
    expect(
      Array.from(roleSelect.querySelectorAll('option')).map((option) => ({
        label: option.textContent,
        value: option.value,
      })),
    ).toEqual([
      { label: 'Administrator', value: 'admin' },
      { label: 'Team member', value: 'standard' },
    ])
  })

  it('renders organization fields in create and edit forms', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    expect(screen.getByLabelText('Departments')).toBeInTheDocument()
    expect(screen.getByLabelText('Primary department')).toBeInTheDocument()
    expect(screen.getByLabelText('Positions')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('Departments')).toBeInTheDocument()
    expect(screen.getByLabelText('Primary department')).toBeInTheDocument()
    expect(screen.getByLabelText('Positions')).toBeInTheDocument()
  })

  it('derives primary department choices from selected departments', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = screen.getByRole('dialog')
    const departmentsSelect = within(dialog).getByLabelText('Departments')
    const primarySelect = within(dialog).getByLabelText('Primary department')

    expect(
      Array.from(primarySelect.querySelectorAll('option')).map(
        (option) => option.value,
      ),
    ).toEqual([''])

    await user.selectOptions(departmentsSelect, [
      'dept-engineering',
      'dept-platform',
    ])

    expect(
      Array.from(primarySelect.querySelectorAll('option')).map((option) => ({
        label: option.textContent,
        value: option.value,
      })),
    ).toEqual([
      { label: 'Select primary department', value: '' },
      { label: 'Engineering', value: 'dept-engineering' },
      { label: 'Platform', value: 'dept-platform' },
    ])
  })

  it('loads edit options with includeIds for disabled assigned departments and positions', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([aliceWithOrganization]))
    vi.mocked(getDepartmentOptions).mockResolvedValue(
      departmentOptionsWithDisabled,
    )
    vi.mocked(getPositionOptions).mockResolvedValue(positionOptionsWithDisabled)

    renderUsersPage()
    await screen.findByText('alice')
    await user.click(screen.getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(getDepartmentOptions).toHaveBeenCalledWith({
        status: 'ACTIVE',
        includeIds: 'dept-engineering,dept-ops',
      })
    })
    await waitFor(() => {
      expect(getPositionOptions).toHaveBeenCalledWith({
        status: 'ACTIVE',
        includeIds: 'position-engineer,position-advisor',
      })
    })

    const dialog = screen.getByRole('dialog')
    const departmentsSelect = within(dialog).getByLabelText('Departments')
    const positionsSelect = within(dialog).getByLabelText('Positions')
    expect(
      within(departmentsSelect).getByRole('option', { name: 'Operations' }),
    ).toBeDisabled()
    expect(
      within(positionsSelect).getByRole('option', { name: 'Advisor' }),
    ).toBeDisabled()
  })

  it('defaults one selected department as primary and clears invalid primary selections', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))
    vi.mocked(createUser).mockResolvedValue(alice)

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    const dialog = screen.getByRole('dialog')
    const departmentsSelect = within(dialog).getByLabelText('Departments')
    const primarySelect = within(dialog).getByLabelText('Primary department')

    await user.selectOptions(departmentsSelect, [
      'dept-engineering',
      'dept-platform',
    ])
    await user.selectOptions(primarySelect, 'dept-engineering')
    expect(primarySelect).toHaveValue('dept-engineering')

    await user.deselectOptions(departmentsSelect, 'dept-engineering')
    expect(primarySelect).toHaveValue('dept-platform')

    await user.selectOptions(departmentsSelect, [
      'dept-engineering',
      'dept-platform',
    ])
    await user.selectOptions(primarySelect, 'dept-engineering')
    expect(primarySelect).toHaveValue('dept-engineering')

    await user.deselectOptions(departmentsSelect, 'dept-engineering')
    await user.selectOptions(departmentsSelect, [
      'dept-engineering',
      'dept-platform',
      'dept-support',
    ])
    await user.selectOptions(primarySelect, 'dept-engineering')
    await user.deselectOptions(departmentsSelect, 'dept-engineering')
    expect(primarySelect).toHaveValue('')
  })

  it('creates users with department and position assignments', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))
    vi.mocked(createUser).mockResolvedValue(alice)

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('First name'), 'Alice')
    await user.type(screen.getByLabelText('Last name'), 'Admin')
    await user.type(screen.getByLabelText('Password'), 'password-1')
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Departments'), [
      'dept-engineering',
      'dept-platform',
    ])
    await user.selectOptions(
      within(dialog).getByLabelText('Primary department'),
      'dept-platform',
    )
    await user.selectOptions(within(dialog).getByLabelText('Positions'), [
      'position-engineer',
      'position-lead',
    ])
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining<CreateUserRequest>({
          departmentIds: ['dept-engineering', 'dept-platform'],
          primaryDepartmentId: 'dept-platform',
          positionIds: ['position-engineer', 'position-lead'],
        }),
      )
    })
  })

  it('omits unchanged assignment fields when updating a user', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([aliceWithOrganization]))
    vi.mocked(getDepartmentOptions).mockResolvedValue(
      departmentOptionsWithDisabled,
    )
    vi.mocked(getPositionOptions).mockResolvedValue(positionOptionsWithDisabled)
    vi.mocked(updateUser).mockResolvedValue(aliceWithOrganization)
    vi.mocked(replaceUserRoles).mockResolvedValue(aliceWithOrganization)

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Alicia')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.not.objectContaining({
          departmentIds: expect.anything(),
          primaryDepartmentId: expect.anything(),
          positionIds: expect.anything(),
        }),
      )
    })
  })

  it('includes current primary department when adding a department during edit', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(
      listResponse([aliceWithPrimaryDepartmentOnly]),
    )
    vi.mocked(updateUser).mockResolvedValue(aliceWithPrimaryDepartmentOnly)
    vi.mocked(replaceUserRoles).mockResolvedValue(
      aliceWithPrimaryDepartmentOnly,
    )

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Departments'), [
      'dept-engineering',
      'dept-platform',
    ])
    await user.selectOptions(
      within(dialog).getByLabelText('Primary department'),
      'dept-engineering',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }))

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining<UpdateUserRequest>({
          departmentIds: ['dept-engineering', 'dept-platform'],
          primaryDepartmentId: 'dept-engineering',
        }),
      )
    })
  })

  it('preserves disabled assignments when editing unrelated fields', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([aliceWithOrganization]))
    vi.mocked(getDepartmentOptions).mockResolvedValue(
      departmentOptionsWithDisabled,
    )
    vi.mocked(getPositionOptions).mockResolvedValue(positionOptionsWithDisabled)
    vi.mocked(updateUser).mockResolvedValue(aliceWithOrganization)
    vi.mocked(replaceUserRoles).mockResolvedValue(aliceWithOrganization)

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')
    const departmentsSelect = within(dialog).getByLabelText('Departments')
    const positionsSelect = within(dialog).getByLabelText('Positions')
    expect(
      within(departmentsSelect).getByRole('option', { name: 'Operations' }),
    ).toBeDisabled()
    expect(
      within(positionsSelect).getByRole('option', { name: 'Advisor' }),
    ).toBeDisabled()

    await user.clear(screen.getByLabelText('Last name'))
    await user.type(screen.getByLabelText('Last name'), 'Owner')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining<UpdateUserRequest>({
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Owner',
          username: 'alice',
        }),
      )
    })
    expect(updateUser).toHaveBeenCalledWith(
      'user-1',
      expect.not.objectContaining({
        departmentIds: expect.anything(),
        primaryDepartmentId: expect.anything(),
        positionIds: expect.anything(),
      }),
    )
  })

  it('passes department and position filters to the users query', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.selectOptions(
      screen.getByLabelText('Filter by department'),
      'dept-engineering',
    )
    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining<UserListQuery>({
          departmentId: 'dept-engineering',
          page: 1,
          pageSize: 20,
        }),
      )
    })

    await user.selectOptions(
      screen.getByLabelText('Filter by position'),
      'position-engineer',
    )
    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining<UserListQuery>({
          departmentId: 'dept-engineering',
          positionId: 'position-engineer',
          page: 1,
          pageSize: 20,
        }),
      )
    })
  })

  it('renders primary department and position summaries in the table', async () => {
    vi.mocked(listUsers).mockResolvedValue(
      listResponse([aliceWithOrganization, brunoWithOrganization]),
    )

    renderUsersPage()

    await screen.findByText('alice')
    const table = screen.getByRole('table')
    expect(within(table).getByText('Engineering')).toBeInTheDocument()
    expect(within(table).getByText('Engineer, Advisor')).toBeInTheDocument()
    expect(within(table).getByText('Lead')).toBeInTheDocument()
  })

  it('keeps user creation usable with selected role codes', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))
    vi.mocked(createUser).mockResolvedValue(alice)

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('First name'), 'Alice')
    await user.type(screen.getByLabelText('Last name'), 'Admin')
    await user.type(screen.getByLabelText('Password'), 'password-1')
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'admin')
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining<CreateUserRequest>({
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Admin',
          password: 'password-1',
          roleCodes: ['admin'],
          username: 'alice',
        }),
      )
    })
  })

  it('queries the list again when the role filter changes', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.selectOptions(screen.getByLabelText('Filter by role'), 'admin')

    await waitFor(() => {
      expect(listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining<UserListQuery>({
          page: 1,
          pageSize: 20,
          roleCode: 'admin',
        }),
      )
    })
  })

  it('does not send a sort query for synthetic full name column clicks', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByText('Full name'))

    expect(listUsers).toHaveBeenCalledTimes(1)
    expect(listUsers).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ sort: 'fullName:asc' }),
    )
  })

  it('refetches the users list and closes the form after create succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([]))
    vi.mocked(createUser).mockResolvedValue(alice)

    renderUsersPage()
    await screen.findByText('No users found')

    await user.click(screen.getByRole('button', { name: 'Create user' }))
    await user.type(screen.getByLabelText('Email'), 'alice@example.com')
    await user.type(screen.getByLabelText('Username'), 'alice')
    await user.type(screen.getByLabelText('First name'), 'Alice')
    await user.type(screen.getByLabelText('Last name'), 'Admin')
    await user.type(screen.getByLabelText('Password'), 'password-1')
    const dialog = screen.getByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'admin')
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith(
        expect.objectContaining<CreateUserRequest>({
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Admin',
          password: 'password-1',
          roleCodes: ['admin'],
          username: 'alice',
        }),
      )
    })
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refetches the users list after update succeeds', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(updateUser).mockResolvedValue({
      ...alice,
      firstName: 'Alicia',
    })
    vi.mocked(replaceUserRoles).mockResolvedValue({
      ...alice,
      firstName: 'Alicia',
    })

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('First name'))
    await user.type(screen.getByLabelText('First name'), 'Alicia')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining<UpdateUserRequest>({
          email: 'alice@example.com',
          firstName: 'Alicia',
          lastName: 'Admin',
          username: 'alice',
        }),
      )
    })
    await waitFor(() => {
      expect(replaceUserRoles).toHaveBeenCalledWith('user-1', {
        roleCodes: ['admin'],
      })
    })
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
  })

  it('replaces roles with the selected role codes when editing a user', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(updateUser).mockResolvedValue(alice)
    vi.mocked(replaceUserRoles).mockResolvedValue({
      ...alice,
      roles: [{ code: 'standard', name: 'Team member' }],
    })

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.deselectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Role'),
      'admin',
    )
    await user.selectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Role'),
      'standard',
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(replaceUserRoles).toHaveBeenCalledWith('user-1', {
        roleCodes: ['standard'],
      })
    })
  })

  it('replaces roles without updating profile fields when only role assignment is allowed', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(replaceUserRoles).mockResolvedValue({
      ...alice,
      roles: [{ code: 'standard', name: 'Team member' }],
    })

    renderUsersPage(['user.assign_roles'])
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Edit' }))
    await user.deselectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Role'),
      'admin',
    )
    await user.selectOptions(
      within(screen.getByRole('dialog')).getByLabelText('Role'),
      'standard',
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit' }),
    )

    await waitFor(() => {
      expect(replaceUserRoles).toHaveBeenCalledWith('user-1', {
        roleCodes: ['standard'],
      })
    })
    expect(updateUser).not.toHaveBeenCalled()
  })

  it('resets a user password and refetches users', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(resetUserPassword).mockResolvedValue(alice)

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    await user.type(screen.getByLabelText('New password'), 'NewPassword123!')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reset password',
      }),
    )

    await waitFor(() => {
      expect(resetUserPassword).toHaveBeenCalledWith('user-1', {
        newPassword: 'NewPassword123!',
      })
    })
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears the session when resetting the current user password', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(resetUserPassword).mockResolvedValue(alice)

    const { router } = renderUsersRoute(alice)
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Reset password' }))
    await user.type(screen.getByLabelText('New password'), 'NewPassword123!')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Reset password',
      }),
    )

    await waitFor(() => {
      expect(resetUserPassword).toHaveBeenCalledWith('user-1', {
        newPassword: 'NewPassword123!',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Starter template')).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('hides create, edit, delete, and role assignment without permissions', async () => {
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))

    renderUsersPage([])
    await screen.findByText('alice')

    expect(
      screen.queryByRole('button', { name: 'Create user' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Delete' }),
    ).not.toBeInTheDocument()
  })

  it('confirms delete, calls delete, and refetches users', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers).mockResolvedValue(listResponse([alice]))
    vi.mocked(deleteUser).mockResolvedValue(undefined)

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete user' }))

    await waitFor(() => {
      expect(deleteUser).toHaveBeenCalledWith('user-1')
    })
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2))
  })

  it('renders an error state with retry', async () => {
    const user = userEvent.setup()
    vi.mocked(listUsers)
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce(listResponse([alice]))

    renderUsersPage()

    expect(
      await screen.findByText('Something went wrong. Request ID: req_test123'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(listUsers).toHaveBeenCalledTimes(2)
  })
})
