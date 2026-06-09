import { create } from 'zustand'
import { clearLegacySession } from '../lib/session-storage'
import type {
  AuthSession,
  AuthStatus,
  UserProfile,
  UserRoleSummary,
} from '../types/auth'

interface AuthState {
  status: AuthStatus
  accessToken: string | null
  user: UserProfile | null
  roles: UserRoleSummary[]
  permissions: string[]
  isAuthenticated: boolean
  setSession: (session: AuthSession) => void
  setUser: (user: UserProfile) => void
  setAnonymous: () => void
  reset: () => void
}

const anonymousState = {
  status: 'anonymous' as const,
  accessToken: null,
  user: null,
  roles: [],
  permissions: [],
  isAuthenticated: false,
}

clearLegacySession()

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  accessToken: null,
  user: null,
  roles: [],
  permissions: [],
  isAuthenticated: false,
  setSession: (session) =>
    set(() => {
      clearLegacySession()
      return {
        status: 'authenticated',
        accessToken: session.accessToken,
        user: session.user,
        roles: session.user.roles,
        permissions: session.user.permissions,
        isAuthenticated: true,
      }
    }),
  setUser: (user) =>
    set(() => ({
      status: 'authenticated',
      user,
      roles: user.roles,
      permissions: user.permissions,
      isAuthenticated: true,
    })),
  setAnonymous: () =>
    set(() => {
      clearLegacySession()
      return anonymousState
    }),
  reset: () =>
    set(() => {
      clearLegacySession()
      return anonymousState
    }),
}))
