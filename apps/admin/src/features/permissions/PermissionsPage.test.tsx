// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { listPermissions } from '../../generated/api/endpoints/permissions/permissions'
import { PermissionsPage } from './PermissionsPage'
import type { PermissionRecord } from '../roles/roles.types'

vi.mock('../../generated/api/endpoints/permissions/permissions', () => ({
  getListPermissionsQueryKey: vi.fn(() => ['/permissions']),
  listPermissions: vi.fn(),
}))

const permissions: PermissionRecord[] = [
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
  {
    id: 'permission-2',
    code: 'role.assign_permissions',
    module: 'role',
    action: 'assign_permissions',
    name: 'Assign role permissions',
    description: null,
    status: 'DISABLED',
    sortOrder: 240,
  },
]

function renderPermissionsPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <PermissionsPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('PermissionsPage', () => {
  beforeEach(() => {
    vi.mocked(listPermissions).mockResolvedValue(permissions)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists permissions as table rows', async () => {
    renderPermissionsPage()

    await waitFor(() => expect(listPermissions).toHaveBeenCalledTimes(1))
    const userPermissionRow = (await screen.findByText('user.read')).closest(
      'tr',
    )
    expect(userPermissionRow).not.toBeNull()
    expect(
      within(userPermissionRow as HTMLTableRowElement).getByText('View users'),
    ).toBeInTheDocument()
    expect(
      within(userPermissionRow as HTMLTableRowElement).getByText('user'),
    ).toBeInTheDocument()
    expect(
      within(userPermissionRow as HTMLTableRowElement).getByText('read'),
    ).toBeInTheDocument()
    expect(
      within(userPermissionRow as HTMLTableRowElement).getByText('ACTIVE'),
    ).toBeInTheDocument()
  })
})
