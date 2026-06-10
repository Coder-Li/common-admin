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
import { api } from '../../app/api-client'
import { clearQueryCache } from '../../app/query-client'
import { I18nProvider } from '../../i18n/I18nProvider'
import { AdminRouterProvider } from '../../routes/router'
import { createAdminRouter } from '../../routes/router-factory'
import { useAuthStore } from '../../stores/auth-store'
import { ThemeProvider } from '../../theme/ThemeProvider'
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserListQuery,
  UserListResponse,
  UserRecord,
} from './users.types'
import { UsersPage } from './UsersPage'

const usersApiMock = vi.hoisted(() => ({
  createUser: vi.fn(),
  deleteUser: vi.fn(),
  listUsers: vi.fn(),
  replaceUserRoles: vi.fn(),
  resetUserPassword: vi.fn(),
  updateUser: vi.fn(),
}))

const rolesApiMock = vi.hoisted(() => ({
  rolesApi: {
    list: vi.fn(),
  },
}))

vi.mock('./users.api', () => usersApiMock)

vi.mock('../roles/roles.api', () => rolesApiMock)

vi.mock('../../app/api-client', () => ({
  api: {
    me: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  },
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
  vi.mocked(api.me).mockResolvedValue({
    id: currentUser.id,
    email: currentUser.email,
    username: currentUser.username,
    firstName: currentUser.firstName,
    lastName: currentUser.lastName,
    roles: [{ code: 'admin', name: 'Admin' }],
    permissions,
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
    vi.mocked(api.me).mockReset()
    vi.mocked(api.me).mockResolvedValue({
      id: 'current-user',
      email: 'admin@example.com',
      username: 'admin',
      firstName: 'Admin',
      lastName: 'User',
      roles: [{ code: 'admin', name: 'Admin' }],
      permissions: [
        'user.create',
        'user.update',
        'user.delete',
        'user.assign_roles',
      ],
    })
    vi.mocked(api.logout).mockReset()
    vi.mocked(api.logout).mockResolvedValue(undefined)
    vi.mocked(api.refresh).mockReset()
    vi.mocked(clearQueryCache).mockReset()
    usersApiMock.createUser.mockReset()
    usersApiMock.deleteUser.mockReset()
    usersApiMock.listUsers.mockReset()
    usersApiMock.replaceUserRoles.mockReset()
    usersApiMock.resetUserPassword.mockReset()
    usersApiMock.updateUser.mockReset()
    rolesApiMock.rolesApi.list.mockReset()
    rolesApiMock.rolesApi.list.mockResolvedValue({
      items: roleOptions,
      page: 1,
      pageSize: 100,
      total: roleOptions.length,
    })
  })

  afterEach(() => {
    cleanup()
    useAuthStore.getState().reset()
  })

  it('renders the loading state while users are loading', () => {
    usersApiMock.listUsers.mockReturnValue(deferred<UserListResponse>().promise)

    renderUsersPage()

    expect(screen.getByText('Loading users')).toBeInTheDocument()
  })

  it('renders an empty state when no users match the query', async () => {
    usersApiMock.listUsers.mockResolvedValue(listResponse([]))

    renderUsersPage()

    expect(await screen.findByText('No users found')).toBeInTheDocument()
  })

  it('renders returned data rows', async () => {
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice, bruno]))

    renderUsersPage()

    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('Bruno Builder')).toBeInTheDocument()
  })

  it('renders table role labels from role records', async () => {
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice, bruno]))

    renderUsersPage()

    expect((await screen.findAllByText('Administrator')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Team member').length).toBeGreaterThan(0)
  })

  it('renders role records in the role filter while keeping all roles', async () => {
    usersApiMock.listUsers.mockResolvedValue(listResponse([]))

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
    usersApiMock.listUsers.mockResolvedValue(listResponse([]))

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

  it('keeps user creation usable with selected role codes', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([]))
    usersApiMock.createUser.mockResolvedValue(alice)

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
      expect(usersApiMock.createUser).toHaveBeenCalledWith(
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
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.selectOptions(screen.getByLabelText('Filter by role'), 'admin')

    await waitFor(() => {
      expect(usersApiMock.listUsers).toHaveBeenLastCalledWith(
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
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByText('Full name'))

    expect(usersApiMock.listUsers).toHaveBeenCalledTimes(1)
    expect(usersApiMock.listUsers).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ sort: 'fullName:asc' }),
    )
  })

  it('refetches the users list and closes the form after create succeeds', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([]))
    usersApiMock.createUser.mockResolvedValue(alice)

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
      expect(usersApiMock.createUser).toHaveBeenCalledWith(
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
    await waitFor(() => expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('refetches the users list after update succeeds', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.updateUser.mockResolvedValue({
      ...alice,
      firstName: 'Alicia',
    })
    usersApiMock.replaceUserRoles.mockResolvedValue({
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
      expect(usersApiMock.updateUser).toHaveBeenCalledWith(
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
      expect(usersApiMock.replaceUserRoles).toHaveBeenCalledWith('user-1', [
        'admin',
      ])
    })
    await waitFor(() => expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2))
  })

  it('replaces roles with the selected role codes when editing a user', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.updateUser.mockResolvedValue(alice)
    usersApiMock.replaceUserRoles.mockResolvedValue({
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
      expect(usersApiMock.replaceUserRoles).toHaveBeenCalledWith('user-1', [
        'standard',
      ])
    })
  })

  it('replaces roles without updating profile fields when only role assignment is allowed', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.replaceUserRoles.mockResolvedValue({
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
      expect(usersApiMock.replaceUserRoles).toHaveBeenCalledWith('user-1', [
        'standard',
      ])
    })
    expect(usersApiMock.updateUser).not.toHaveBeenCalled()
  })

  it('resets a user password and refetches users', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.resetUserPassword.mockResolvedValue(undefined)

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
      expect(usersApiMock.resetUserPassword).toHaveBeenCalledWith('user-1', {
        newPassword: 'NewPassword123!',
      })
    })
    await waitFor(() => expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clears the session when resetting the current user password', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.resetUserPassword.mockResolvedValue(undefined)

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
      expect(usersApiMock.resetUserPassword).toHaveBeenCalledWith('user-1', {
        newPassword: 'NewPassword123!',
      })
    })
    await waitFor(() => {
      expect(screen.getByText('Sign in to continue')).toBeInTheDocument()
    })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(clearQueryCache).toHaveBeenCalledOnce()
  })

  it('hides create, edit, delete, and role assignment without permissions', async () => {
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))

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
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))
    usersApiMock.deleteUser.mockResolvedValue(undefined)

    renderUsersPage()
    await screen.findByText('alice')

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await user.click(screen.getByRole('button', { name: 'Delete user' }))

    await waitFor(() => {
      expect(usersApiMock.deleteUser).toHaveBeenCalledWith('user-1')
    })
    await waitFor(() => expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2))
  })

  it('renders an error state with retry', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers
      .mockRejectedValueOnce(new Error('Users are unavailable'))
      .mockResolvedValueOnce(listResponse([alice]))

    renderUsersPage()

    expect(await screen.findByText('Users are unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('alice')).toBeInTheDocument()
    expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2)
  })
})
