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
  updateUser: vi.fn(),
}))

vi.mock('./users.api', () => usersApiMock)

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
  role: 'ADMIN',
  createdAt: '2026-01-02T03:04:05.000Z',
  updatedAt: '2026-01-02T03:04:05.000Z',
}

const bruno: UserRecord = {
  id: 'user-2',
  email: 'bruno@example.com',
  username: 'bruno',
  firstName: 'Bruno',
  lastName: 'Builder',
  role: 'STANDARD',
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

function renderUsersPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
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

describe('UsersPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    usersApiMock.createUser.mockReset()
    usersApiMock.deleteUser.mockReset()
    usersApiMock.listUsers.mockReset()
    usersApiMock.updateUser.mockReset()
  })

  afterEach(() => {
    cleanup()
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

  it('queries the list again when the role filter changes', async () => {
    const user = userEvent.setup()
    usersApiMock.listUsers.mockResolvedValue(listResponse([alice]))

    renderUsersPage()
    await screen.findByText('alice')

    await user.selectOptions(screen.getByLabelText('Filter by role'), 'ADMIN')

    await waitFor(() => {
      expect(usersApiMock.listUsers).toHaveBeenLastCalledWith(
        expect.objectContaining<UserListQuery>({
          page: 1,
          pageSize: 20,
          role: 'ADMIN',
        }),
      )
    })
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
    await user.selectOptions(within(dialog).getByLabelText('Role'), 'ADMIN')
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }))

    await waitFor(() => {
      expect(usersApiMock.createUser).toHaveBeenCalledWith(
        expect.objectContaining<CreateUserRequest>({
          email: 'alice@example.com',
          firstName: 'Alice',
          lastName: 'Admin',
          password: 'password-1',
          role: 'ADMIN',
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
          role: 'ADMIN',
          username: 'alice',
        }),
      )
    })
    await waitFor(() => expect(usersApiMock.listUsers).toHaveBeenCalledTimes(2))
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
