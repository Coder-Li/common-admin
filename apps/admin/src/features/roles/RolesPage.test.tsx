// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { useAuthStore } from '../../stores/auth-store'
import { getDepartmentOptions } from '../../generated/api/endpoints/departments/departments'
import { listPermissionModules } from '../../generated/api/endpoints/permissions/permissions'
import {
  createRole,
  deleteRole,
  listRoles,
  replaceRolePermissions,
  updateRole,
} from '../../generated/api/endpoints/roles/roles'
import { RolesPage } from './RolesPage'
import type { PermissionModule, RoleRecord } from './roles.types'

vi.mock('../../generated/api/endpoints/permissions/permissions', () => ({
  getListPermissionModulesQueryKey: vi.fn(() => ['/permissions/modules']),
  listPermissionModules: vi.fn(),
}))

vi.mock('../../generated/api/endpoints/departments/departments', () => ({
  getDepartmentOptions: vi.fn(),
  getGetDepartmentOptionsQueryKey: vi.fn((params?: unknown) =>
    params ? ['/departments/options', params] : ['/departments/options'],
  ),
}))

vi.mock('../../generated/api/endpoints/roles/roles', () => ({
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  getListRolesQueryKey: vi.fn((params?: unknown) =>
    params ? ['/roles', params] : ['/roles'],
  ),
  listRoles: vi.fn(),
  replaceRolePermissions: vi.fn(),
  updateRole: vi.fn(),
}))

const roles: RoleRecord[] = [
  {
    id: 'role-1',
    code: 'admin',
    name: 'Admin',
    description: null,
    status: 'ACTIVE',
    isSystem: true,
    isDefault: false,
    dataScope: 'ALL',
    dataScopeDepartments: [],
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
    dataScope: 'CUSTOM_DEPT',
    dataScopeDepartments: [
      {
        id: 'dept-1',
        code: 'engineering',
        name: 'Engineering',
        status: 'ACTIVE',
      },
      {
        id: 'dept-2',
        code: 'legacy',
        name: 'Legacy',
        status: 'DISABLED',
      },
    ],
    permissions: [{ code: 'file.read', name: 'View files' }],
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
  },
  {
    id: 'role-3',
    code: 'standard',
    name: 'Standard',
    description: null,
    status: 'ACTIVE',
    isSystem: true,
    isDefault: false,
    dataScope: 'SELF',
    dataScopeDepartments: [],
    permissions: [],
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

const apiError = {
  code: 'INTERNAL_SERVER_ERROR',
  message: 'Internal server error',
  statusCode: 500,
  requestId: 'req_test123',
}

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
    vi.mocked(listRoles).mockResolvedValue({
      items: roles,
      total: roles.length,
      page: 1,
      pageSize: 20,
    })
    vi.mocked(listPermissionModules).mockResolvedValue(modules)
    vi.mocked(getDepartmentOptions).mockResolvedValue([
      {
        id: 'dept-1',
        code: 'engineering',
        name: 'Engineering',
        parentId: null,
        status: 'ACTIVE',
      },
    ])
    vi.mocked(createRole).mockResolvedValue(roles[1])
    vi.mocked(updateRole).mockResolvedValue(roles[1])
    vi.mocked(deleteRole).mockResolvedValue(undefined)
    vi.mocked(replaceRolePermissions).mockResolvedValue(roles[1])
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
    expect(listRoles).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      search: undefined,
      sort: undefined,
    })
    expect(listPermissionModules).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByRole('heading', { name: 'Available permissions' }),
    ).not.toBeInTheDocument()
  })

  it('renders an error state with retry', async () => {
    const user = userEvent.setup()
    vi.mocked(listRoles)
      .mockRejectedValueOnce(apiError)
      .mockResolvedValueOnce({
        items: roles,
        total: roles.length,
        page: 1,
        pageSize: 20,
      })

    renderRolesPage()

    expect(
      await screen.findByText('Something went wrong. Request ID: req_test123'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Internal server error')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(listRoles).toHaveBeenCalledTimes(2)
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

    expect(replaceRolePermissions).toHaveBeenCalledWith('role-2', {
      permissionCodes: ['file.read', 'user.read'],
    })
  })

  it('hides assignment action without role.assign_permissions', async () => {
    renderRolesPage(['role.read', 'permission.read'])

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Permissions' }),
    ).not.toBeInTheDocument()
  })

  it('hides update and delete actions without role.update and role.delete', async () => {
    renderRolesPage(['role.read', 'role.assign_permissions', 'permission.read'])

    const operatorRow = (await screen.findByText('operator')).closest('tr')
    expect(operatorRow).not.toBeNull()
    expect(
      within(operatorRow as HTMLTableRowElement).queryByRole('button', {
        name: 'Edit',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(operatorRow as HTMLTableRowElement).queryByRole('button', {
        name: 'Delete',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(operatorRow as HTMLTableRowElement).getByRole('button', {
        name: 'Permissions',
      }),
    ).toBeInTheDocument()
  })

  it('hides permission panel without permission.read', async () => {
    renderRolesPage(['role.read'])

    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.queryByText('View users')).not.toBeInTheDocument()
  })

  it('submits SELF by default on create', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await user.click(await screen.findByRole('button', { name: 'Create role' }))
    await user.type(screen.getByLabelText('Code'), 'auditor')
    await user.type(screen.getByLabelText('Name'), 'Auditor')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create role',
      }),
    )

    expect(vi.mocked(createRole)).toHaveBeenCalledWith(
      expect.objectContaining({ dataScope: 'SELF' }),
    )
  })

  it('shows custom department checkboxes only for CUSTOM_DEPT roles', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await user.click(await screen.findByRole('button', { name: 'Create role' }))
    expect(
      screen.queryByRole('checkbox', { name: 'Engineering' }),
    ).not.toBeInTheDocument()
  })

  it('submits selected active custom departments on create', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await user.click(await screen.findByRole('button', { name: 'Create role' }))
    await user.type(screen.getByLabelText('Code'), 'platform_admin')
    await user.type(screen.getByLabelText('Name'), 'Platform admin')
    await user.selectOptions(screen.getByLabelText('Data scope'), 'CUSTOM_DEPT')
    expect(await screen.findByRole('checkbox', { name: 'Engineering' })).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Engineering' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create role',
      }),
    )

    expect(vi.mocked(createRole)).toHaveBeenCalledWith(
      expect.objectContaining({
        dataScope: 'CUSTOM_DEPT',
        dataScopeDepartmentIds: ['dept-1'],
      }),
    )
  })

  it('shows role data scope in the table', async () => {
    renderRolesPage()

    expect(await screen.findByText('All')).toBeInTheDocument()
    expect(screen.getByText('Self')).toBeInTheDocument()
    expect(screen.getByText('Custom departments (2)')).toBeInTheDocument()
  })

  it('shows disabled linked departments in edit mode without submitting them', async () => {
    const user = userEvent.setup()
    renderRolesPage()

    await user.click(
      within((await screen.findByText('operator')).closest('tr') as HTMLTableRowElement).getByRole(
        'button',
        { name: 'Edit' },
      ),
    )
    expect(screen.getByRole('checkbox', { name: 'Engineering' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Legacy' })).toBeDisabled()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Edit',
      }),
    )

    expect(vi.mocked(updateRole)).toHaveBeenCalledWith(
      'role-2',
      expect.objectContaining({
        dataScope: 'CUSTOM_DEPT',
        dataScopeDepartmentIds: ['dept-1'],
      }),
    )
  })
})
