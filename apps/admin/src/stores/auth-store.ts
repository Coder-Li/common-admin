import { create } from 'zustand'
import { clearSession, loadSession, saveSession } from '../lib/session-storage'
import type { AuthSession, UserProfile } from '../types/auth'

interface AuthState {
  accessToken: string | null
  user: UserProfile | null
  isAuthenticated: boolean
  setSession: (session: AuthSession) => void
  setUser: (user: UserProfile) => void
  reset: () => void
}

const initialSession = loadSession()

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: initialSession?.accessToken ?? null,
  user: initialSession?.user ?? null,
  isAuthenticated: Boolean(initialSession),
  setSession: (session) =>
    set(() => {
      saveSession(session)
      return {
        accessToken: session.accessToken,
        user: session.user,
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

      return { user, isAuthenticated: true }
    }),
  reset: () =>
    set(() => {
      clearSession()
      return {
        accessToken: null,
        user: null,
        isAuthenticated: false,
      }
    }),
}))
