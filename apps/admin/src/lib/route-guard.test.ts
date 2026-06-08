import { describe, expect, it } from 'vitest'
import { resolveRoute } from './route-guard'

describe('route guard', () => {
  it('sends authenticated users from root to dashboard', () => {
    expect(resolveRoute('/', true).redirectTo).toBe('/dashboard')
  })

  it('sends anonymous users from root to login', () => {
    expect(resolveRoute('/', false).redirectTo).toBe('/login')
  })

  it('keeps authenticated users away from the login page', () => {
    expect(resolveRoute('/login', true).redirectTo).toBe('/dashboard')
  })

  it('protects backend pages from anonymous users', () => {
    expect(resolveRoute('/users', false).redirectTo).toBe('/login')
  })

  it('allows authenticated users to visit backend pages', () => {
    expect(resolveRoute('/settings', true)).toEqual({
      path: '/settings',
      redirectTo: null,
    })
  })

  it('allows authenticated users to visit dictionary management', () => {
    expect(resolveRoute('/dictionaries', true)).toEqual({
      path: '/dictionaries',
      redirectTo: null,
    })
  })

  it('redirects anonymous dictionary management visits to login', () => {
    expect(resolveRoute('/dictionaries', false)).toEqual({
      path: '/dictionaries',
      redirectTo: '/login',
    })
  })
})
