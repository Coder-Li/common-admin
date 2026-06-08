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
  CreateDictionaryItemRequest,
  CreateDictionaryTypeRequest,
  DictionaryItemListQuery,
  DictionaryItemListResponse,
  DictionaryItemRecord,
  DictionaryTypeListQuery,
  DictionaryTypeListResponse,
  DictionaryTypeRecord,
  UpdateDictionaryTypeRequest,
} from './dictionaries.types'
import { DictionariesPage } from './DictionariesPage'

const dictionariesApiMock = vi.hoisted(() => ({
  createDictionaryItem: vi.fn(),
  createDictionaryType: vi.fn(),
  deleteDictionaryItem: vi.fn(),
  deleteDictionaryType: vi.fn(),
  listDictionaryItems: vi.fn(),
  listDictionaryTypes: vi.fn(),
  updateDictionaryItem: vi.fn(),
  updateDictionaryType: vi.fn(),
}))

vi.mock('./dictionaries.api', () => dictionariesApiMock)

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

const userRoleType: DictionaryTypeRecord = {
  id: 'type-user-role',
  code: 'user_role',
  name: 'User role',
  status: 'ACTIVE',
  isSystem: true,
  description: 'Seeded user roles',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T01:00:00.000Z',
}

const commonStatusType: DictionaryTypeRecord = {
  id: 'type-common-status',
  code: 'common_status',
  name: 'Common status',
  status: 'DISABLED',
  isSystem: false,
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T02:00:00.000Z',
}

const adminItem: DictionaryItemRecord = {
  id: 'item-admin',
  typeId: 'type-user-role',
  typeCode: 'user_role',
  typeName: 'User role',
  value: 'ADMIN',
  label: 'Admin',
  sortOrder: 10,
  status: 'ACTIVE',
  isSystem: true,
  isDefault: false,
  badgeVariant: 'DANGER',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T01:00:00.000Z',
}

const standardItem: DictionaryItemRecord = {
  id: 'item-standard',
  typeId: 'type-user-role',
  typeCode: 'user_role',
  typeName: 'User role',
  value: 'STANDARD',
  label: 'Standard',
  sortOrder: 20,
  status: 'ACTIVE',
  isSystem: false,
  isDefault: true,
  badgeVariant: 'NEUTRAL',
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T02:00:00.000Z',
}

function typeListResponse(
  items: DictionaryTypeRecord[],
): DictionaryTypeListResponse {
  return {
    items,
    page: 1,
    pageSize: 20,
    total: items.length,
  }
}

function itemListResponse(
  items: DictionaryItemRecord[],
): DictionaryItemListResponse {
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

function renderDictionariesPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <DictionariesPage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

describe('DictionariesPage', () => {
  beforeEach(() => {
    window.localStorage.clear()
    Object.values(dictionariesApiMock).forEach((mock) => mock.mockReset())
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(itemListResponse([]))
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the loading state while dictionary types are loading', () => {
    dictionariesApiMock.listDictionaryTypes.mockReturnValue(
      deferred<DictionaryTypeListResponse>().promise,
    )

    renderDictionariesPage()

    expect(screen.getByText('Loading dictionary types')).toBeInTheDocument()
  })

  it('renders an empty state when no dictionary types match', async () => {
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(typeListResponse([]))

    renderDictionariesPage()

    expect(await screen.findByText('No dictionary types found')).toBeInTheDocument()
  })

  it('renders returned dictionary type rows', async () => {
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType, commonStatusType]),
    )

    renderDictionariesPage()

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: 'Select user_role' }).length,
      ).toBeGreaterThan(0)
    })
    expect(
      screen.getByRole('button', { name: 'Select common_status' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('User role').length).toBeGreaterThan(0)
    expect(screen.getByText('Common status')).toBeInTheDocument()
    expect(screen.getByText('DISABLED')).toBeInTheDocument()
    expect(screen.getByText('System')).toBeInTheDocument()
  })

  it('queries items by selected dictionary type and renders item columns', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([commonStatusType, userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(
      itemListResponse([adminItem, standardItem]),
    )

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select common_status' })

    await user.click(screen.getByRole('button', { name: /Select user_role/ }))

    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryItems).toHaveBeenLastCalledWith(
        expect.objectContaining<DictionaryItemListQuery>({
          page: 1,
          pageSize: 20,
          typeId: 'type-user-role',
        }),
      )
    })
    const adminRow = (await screen.findByText('ADMIN')).closest('tr')
    expect(within(adminRow!).getByText('Admin')).toBeInTheDocument()
    expect(within(adminRow!).getByText('10')).toBeInTheDocument()
    expect(within(adminRow!).getByText('DANGER')).toBeInTheDocument()

    const standardRow = screen.getByText('STANDARD').closest('tr')
    expect(within(standardRow!).getByText('Default')).toBeInTheDocument()
  })

  it('sends search and supported sort params without sorting by badge variant', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(
      itemListResponse([adminItem]),
    )

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select user_role' })

    await user.type(screen.getByLabelText('Search types'), 'role')
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenLastCalledWith(
        expect.objectContaining<DictionaryTypeListQuery>({
          page: 1,
          pageSize: 20,
          search: 'role',
        }),
      )
    })

    await user.click(screen.getAllByRole('button', { name: 'Updated' })[0])
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenLastCalledWith(
        expect.objectContaining<DictionaryTypeListQuery>({
          page: 1,
          pageSize: 20,
          search: 'role',
          sort: 'updatedAt:asc',
        }),
      )
    })

    await user.type(screen.getByLabelText('Search items'), 'admin')
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryItems).toHaveBeenLastCalledWith(
        expect.objectContaining<DictionaryItemListQuery>({
          page: 1,
          pageSize: 20,
          search: 'admin',
          typeId: 'type-user-role',
        }),
      )
    })

    await user.click(screen.getByText('Badge'))

    expect(dictionariesApiMock.listDictionaryItems).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ sort: 'badgeVariant:asc' }),
    )
  })

  it('validates required dictionary type fields', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(typeListResponse([]))

    renderDictionariesPage()
    await screen.findByText('No dictionary types found')

    await user.click(screen.getByRole('button', { name: 'Create type' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create type',
      }),
    )

    expect(await screen.findByText('Code is required')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(dictionariesApiMock.createDictionaryType).not.toHaveBeenCalled()
  })

  it('validates required dictionary item fields', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(itemListResponse([]))

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select user_role' })

    await user.click(screen.getByRole('button', { name: 'Create item' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create item',
      }),
    )

    expect(await screen.findByText('Value is required')).toBeInTheDocument()
    expect(screen.getByText('Label is required')).toBeInTheDocument()
    expect(dictionariesApiMock.createDictionaryItem).not.toHaveBeenCalled()
  })

  it('protects system type and item delete actions', async () => {
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(
      itemListResponse([adminItem]),
    )

    renderDictionariesPage()

    await screen.findByRole('button', { name: 'Select user_role' })
    await screen.findByText('ADMIN')

    screen
      .getAllByRole('button', { name: 'Delete' })
      .forEach((button) => expect(button).toBeDisabled())
  })

  it('refetches the type list after update succeeds', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([commonStatusType]),
    )
    dictionariesApiMock.updateDictionaryType.mockResolvedValue({
      ...commonStatusType,
      name: 'Status',
    })

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select common_status' })

    const typeRow = screen
      .getByRole('button', { name: 'Select common_status' })
      .closest('tr')
    await user.click(within(typeRow!).getByRole('button', { name: 'Edit' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Status')
    await user.click(
      within(screen.getByRole('dialog', { name: 'Edit' })).getByRole('button', {
        name: 'Edit',
      }),
    )

    await waitFor(() => {
      expect(dictionariesApiMock.updateDictionaryType).toHaveBeenCalledWith(
        'type-common-status',
        expect.objectContaining<UpdateDictionaryTypeRequest>({
          name: 'Status',
        }),
      )
    })
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows confirmation before deleting a non-system item', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(
      itemListResponse([standardItem]),
    )
    dictionariesApiMock.deleteDictionaryItem.mockResolvedValue(undefined)

    renderDictionariesPage()
    const itemRow = (await screen.findByText('STANDARD')).closest('tr')

    await user.click(within(itemRow!).getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog')).toHaveTextContent('Delete item')
    await user.click(screen.getByRole('button', { name: 'Delete item' }))

    await waitFor(() => {
      expect(dictionariesApiMock.deleteDictionaryItem).toHaveBeenCalledWith(
        'item-standard',
      )
    })
  })

  it('shows confirmation before deleting a non-system type', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([commonStatusType]),
    )
    dictionariesApiMock.deleteDictionaryType.mockResolvedValue(undefined)

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select common_status' })
    const typeRow = screen
      .getByRole('button', { name: 'Select common_status' })
      .closest('tr')

    await user.click(within(typeRow!).getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog', { name: 'Delete type' })).toHaveTextContent(
      'common_status',
    )
    await user.click(screen.getByRole('button', { name: 'Delete type' }))

    await waitFor(() => {
      expect(dictionariesApiMock.deleteDictionaryType).toHaveBeenCalledWith(
        'type-common-status',
      )
    })
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenCalledTimes(2)
    })
  })

  it('refetches affected queries after create and delete success', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes.mockResolvedValue(
      typeListResponse([userRoleType]),
    )
    dictionariesApiMock.listDictionaryItems.mockResolvedValue(itemListResponse([]))
    dictionariesApiMock.createDictionaryType.mockResolvedValue(commonStatusType)
    dictionariesApiMock.createDictionaryItem.mockResolvedValue(standardItem)
    dictionariesApiMock.deleteDictionaryType.mockResolvedValue(undefined)

    renderDictionariesPage()
    await screen.findByRole('button', { name: 'Select user_role' })

    await user.click(screen.getByRole('button', { name: 'Create type' }))
    await user.type(screen.getByLabelText('Code'), 'common_status')
    await user.type(screen.getByLabelText('Name'), 'Common status')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create type',
      }),
    )

    await waitFor(() => {
      expect(dictionariesApiMock.createDictionaryType).toHaveBeenCalledWith(
        expect.objectContaining<CreateDictionaryTypeRequest>({
          code: 'common_status',
          name: 'Common status',
        }),
      )
    })
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenCalledTimes(2)
    })

    await user.click(screen.getByRole('button', { name: 'Create item' }))
    await user.type(screen.getByLabelText('Value'), 'STANDARD')
    await user.type(screen.getByLabelText('Label'), 'Standard')
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Create item',
      }),
    )

    await waitFor(() => {
      expect(dictionariesApiMock.createDictionaryItem).toHaveBeenCalledWith(
        expect.objectContaining<CreateDictionaryItemRequest>({
          label: 'Standard',
          typeId: 'type-user-role',
          value: 'STANDARD',
        }),
      )
    })
    await waitFor(() => {
      expect(dictionariesApiMock.listDictionaryItems).toHaveBeenCalledTimes(2)
    })
  })

  it('renders an error state with retry for dictionary types', async () => {
    const user = userEvent.setup()
    dictionariesApiMock.listDictionaryTypes
      .mockRejectedValueOnce(new Error('Dictionary types are unavailable'))
      .mockResolvedValueOnce(typeListResponse([userRoleType]))

    renderDictionariesPage()

    expect(
      await screen.findByText('Dictionary types are unavailable'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('button', { name: 'Select user_role' }),
    ).toBeInTheDocument()
    expect(dictionariesApiMock.listDictionaryTypes).toHaveBeenCalledTimes(2)
  })
})
