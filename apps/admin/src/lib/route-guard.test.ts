import { describe, expect, it } from 'vitest'
import { resolveRoute } from './route-guard'

const checking = { status: 'checking' as const, permissions: [] }
const anonymous = { status: 'anonymous' as const, permissions: [] }
const admin = {
  status: 'authenticated' as const,
  permissions: [
    'dashboard.view',
    'user.read',
    'role.read',
    'dictionary.read',
    'file.read',
    'audit_log.read',
    'setting.read',
  ],
}

describe('route guard', () => {
  it('sends authenticated users from root to dashboard', () => {
    expect(resolveRoute('/', admin).redirectTo).toBe('/dashboard')
  })

  it('sends anonymous users from root to login', () => {
    expect(resolveRoute('/', anonymous).redirectTo).toBe('/login')
  })

  it('keeps authenticated users away from the login page using the first visible route', () => {
    expect(
      resolveRoute('/login', {
        status: 'authenticated',
        permissions: ['user.read'],
      }).redirectTo,
    ).toBe('/users')
  })

  it('waits on protected routes while auth is checking', () => {
    expect(resolveRoute('/users', checking)).toEqual({
      path: '/users',
      redirectTo: null,
      status: 'checking',
    })
  })

  it('protects backend pages from anonymous users', () => {
    expect(resolveRoute('/users', anonymous)).toMatchObject({
      redirectTo: '/login',
      status: 'login',
    })
  })

  it('redirects authenticated users without route permission to forbidden', () => {
    expect(
      resolveRoute('/users', {
        status: 'authenticated',
        permissions: ['dashboard.view'],
      }),
    ).toMatchObject({
      path: '/users',
      redirectTo: '/403',
      status: 'forbidden',
    })
  })

  it('allows authenticated users with route permission to visit backend pages', () => {
    expect(resolveRoute('/settings', admin)).toEqual({
      path: '/settings',
      redirectTo: null,
      status: 'ok',
    })
  })

  it('allows authenticated users to visit dictionary management', () => {
    expect(resolveRoute('/dictionaries', admin)).toEqual({
      path: '/dictionaries',
      redirectTo: null,
      status: 'ok',
    })
  })

  it('redirects anonymous dictionary management visits to login', () => {
    expect(resolveRoute('/dictionaries', anonymous)).toEqual({
      path: '/dictionaries',
      redirectTo: '/login',
      status: 'login',
    })
  })

  it('allows authenticated users to visit file management', () => {
    expect(resolveRoute('/files', admin)).toEqual({
      path: '/files',
      redirectTo: null,
      status: 'ok',
    })
  })

  it('redirects anonymous file management visits to login', () => {
    expect(resolveRoute('/files', anonymous)).toEqual({
      path: '/files',
      redirectTo: '/login',
      status: 'login',
    })
  })

  it('allows authenticated users to visit audit logs', () => {
    expect(resolveRoute('/audit-logs', admin)).toEqual({
      path: '/audit-logs',
      redirectTo: null,
      status: 'ok',
    })
  })

  it('redirects direct audit log visits without permission to forbidden', () => {
    expect(
      resolveRoute('/audit-logs', {
        status: 'authenticated',
        permissions: ['dashboard.view'],
      }),
    ).toEqual({
      path: '/audit-logs',
      redirectTo: '/403',
      status: 'forbidden',
    })
  })

  it('keeps forbidden and not-found routes visible for authenticated users', () => {
    expect(resolveRoute('/403', admin)).toEqual({
      path: '/403',
      redirectTo: null,
      status: 'forbidden',
    })
    expect(resolveRoute('/404', admin)).toEqual({
      path: '/404',
      redirectTo: null,
      status: 'not_found',
    })
  })

  it('sends unknown authenticated routes to not found', () => {
    expect(resolveRoute('/missing', admin)).toEqual({
      path: '/missing',
      redirectTo: '/404',
      status: 'not_found',
    })
  })
})
