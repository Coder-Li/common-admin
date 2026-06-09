// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '../../i18n/I18nProvider'
import { PermissionsPage } from './PermissionsPage'
import { permissionsApi } from './permissions.api'
import type { PermissionModule } from '../roles/roles.types'

vi.mock('./permissions.api', () => ({
  permissionsApi: {
    listModules: vi.fn(),
  },
}))

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
        description: 'Allows reading users',
        status: 'ACTIVE',
        sortOrder: 100,
      },
    ],
  },
  {
    module: 'role',
    permissions: [
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
    ],
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
    vi.mocked(permissionsApi.listModules).mockResolvedValue(modules)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('lists permission modules as table rows', async () => {
    renderPermissionsPage()

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
