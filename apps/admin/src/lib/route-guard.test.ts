import { describe, expect, it } from 'vitest'
import { resolveRoute } from './route-guard'

const anonymous = { isAuthenticated: false, permissions: [] }
const admin = {
  isAuthenticated: true,
  permissions: [
    'dashboard.view',
    'user.read',
    'role.read',
    'dictionary.read',
    'file.read',
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
        isAuthenticated: true,
        permissions: ['user.read'],
      }).redirectTo,
    ).toBe('/users')
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
        isAuthenticated: true,
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
