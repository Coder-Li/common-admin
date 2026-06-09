// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import { RolesPage } from './RolesPage'
import { rolesApi } from './roles.api'
import type { PermissionModule, RoleRecord } from './roles.types'

vi.mock('./roles.api', () => ({
  rolesApi: {
    create: vi.fn(),
    list: vi.fn(),
    listPermissionModules: vi.fn(),
    remove: vi.fn(),
    replacePermissions: vi.fn(),
    update: vi.fn(),
  },
}))

const roles: RoleRecord[] = [
  {
    id: 'role-1',
    code: 'admin',
    name: 'Admin',
    description: 'Administrators',
    status: 'ACTIVE',
    isSystem: true,
    isDefault: false,
    permissions: [{ code: 'user.read', name: 'View users' }],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
  },
  {
    id: 'role-2',
    code: 'operator',
    name: 'Operator',
    description: null,
    status: 'ACTIVE',
    isSystem: false,
    isDefault: true,
    permissions: [{ code: 'file.read', name: 'View files' }],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
  },
]

const modules: PermissionModule[] = [
  {
    module: 'user',
    permissions: [
      {
        id: 'permission-1',
        code: 'user.read',
        module: 'user',
        action: 'read',
        name: 'View users',
        description: null,
        status: 'ACTIVE',
        sortOrder: 100,
      },
    ],
  },
  {
    module: 'file',
    permissions: [
      {
        id: 'permission-2',
        code: 'file.read',
        module: 'file',
        action: 'read',
        name: 'View files',
        description: null,
        status: 'ACTIVE',
        sortOrder: 200,
      },
    ],
  },
]

function renderRolesPage(permissions = [
  'role.read',
  'role.create',
  'role.update',
  'role.delete',
  'role.assign_permissions',
  'permission.read',
]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  useAuthStore.getState().setSession({
    accessToken: 'access-token',
    user: {
      id: 'user-1',
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
        <RolesPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('RolesPage', () => {
  beforeEach(() => {
    vi.mocked(rolesApi.list).mockResolvedValue({
      items: roles,
      total: roles.length,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(rolesApi.listPermissionModules).mockResolvedValue(modules)
    vi.mocked(rolesApi.create).mockResolvedValue(roles[1])
    vi.mocked(rolesApi.update).mockResolvedValue(roles[1])
    vi.mocked(rolesApi.remove).mockResolvedValue(undefined)
    vi.mocked(rolesApi.replacePermissions).mockResolvedValue(roles[1])
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    useAuthStore.getState().reset()
  })

  it('lists roles without the standalone permission catalogue', async () => {
    renderRolesPage()

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Operator')).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Available permissions' }),
    ).not.toBeInTheDocument()
  })

  it('opens create dialog when role.create is granted', async () => {
    const user = userEvent.setup()
    renderRolesPage(['role.read', 'role.create'])

    await user.click(await screen.findByRole('button', { name: 'Create role' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('Code')).toBeInTheDocument()
  })

  it('hides create action without role.create', async () => {
    renderRolesPage(['role.read'])

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Create role' }),
    ).not.toBeInTheDocument()
  })

  it('blocks delete for system roles', async () => {
    renderRolesPage()

    const adminRow = (await screen.findByText('admin')).closest('tr')
    expect(adminRow).not.toBeNull()
    expect(
      within(adminRow as HTMLTableRowElement).getByRole('button', {
        name: 'Delete',
      }),
    ).toBeDisabled()
  })

  it('replaces permissions with selected permission codes', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    const operatorRow = (await screen.findByText('operator')).closest('tr')
    expect(operatorRow).not.toBeNull()
    await user.click(
      within(operatorRow as HTMLTableRowElement).getByRole('button', {
        name: 'Permissions',
      }),
    )
    await user.click(screen.getByLabelText('View users'))
    await user.click(screen.getByRole('button', { name: 'Save permissions' }))

    expect(rolesApi.replacePermissions).toHaveBeenCalledWith('role-2', [
      'file.read',
      'user.read',
    ])
  })

  it('hides assignment action without role.assign_permissions', async () => {
    renderRolesPage(['role.read', 'permission.read'])

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Permissions' }),
    ).not.toBeInTheDocument()
  })

  it('hides permission panel without permission.read', async () => {
    renderRolesPage(['role.read'])

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('View users')).not.toBeInTheDocument()
  })
})
