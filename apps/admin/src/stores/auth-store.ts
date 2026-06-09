import { create } from 'zustand'
import { clearSession, loadSession, saveSession } from '../lib/session-storage'
import type { AuthSession, UserProfile, UserRoleSummary } from '../types/auth'

interface AuthState {
  accessToken: string | null
  user: UserProfile | null
  roles: UserRoleSummary[]
  permissions: string[]
  isAuthenticated: boolean
  setSession: (session: AuthSession) => void
  setUser: (user: UserProfile) => void
  reset: () => void
}

const initialSession = loadSession()

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialSession?.accessToken ?? null,
  user: initialSession?.user ?? null,
  roles: initialSession?.user.roles ?? [],
  permissions: initialSession?.user.permissions ?? [],
  isAuthenticated: Boolean(initialSession),
  setSession: (session) =>
    set(() => {
      saveSession(session)
      return {
        accessToken: session.accessToken,
        user: session.user,
        roles: session.user.roles,
        permissions: session.user.permissions,
        isAuthenticated: true,
      }
    }),
  setUser: (user) =>
    set((state) => {
      if (state.accessToken) {
        saveSession({
          accessToken: state.accessToken,
          user,
        })
      }

      return {
        user,
        roles: user.roles,
        permissions: user.permissions,
        isAuthenticated: true,
      }
    }),
  reset: () =>
    set(() => {
      clearSession()
      return {
        accessToken: null,
        user: null,
        roles: [],
        permissions: [],
        isAuthenticated: false,
      }
    }),
}))
