import { create } from "zustand"
import type { User, LoginRequest } from "@/domain/entities/user"
import { authApi } from "@/infrastructure/api/auth-api"
import { tokenStorage } from "@/infrastructure/storage/token-storage"
import { setWsToken } from "@/infrastructure/api/client"

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  initialized: boolean

  initialize: () => Promise<void>
  login: (data: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    // 1. Intentar con token_permanente de la URL (auth por link mágico)
    const urlToken = new URLSearchParams(window.location.search).get("token_permanente")
    if (urlToken) {
      set({ loading: true })
      try {
        const res = await authApi.loginWithCode(urlToken)
        tokenStorage.setToken(res.token)
        setWsToken(res.token)
        const cleanUrl = window.location.pathname + window.location.hash
        window.history.replaceState(null, "", cleanUrl)
        set({ user: res.user, token: res.token, loading: false, initialized: true })
        return
      } catch {
        tokenStorage.clear()
        setWsToken(null)
      }
    }

    // 2. Intentar con token guardado en localStorage
    const token = tokenStorage.getToken()
    if (!token) {
      set({ initialized: true })
      return
    }
    set({ loading: true, token })
    setWsToken(token)
    try {
      const user = await authApi.me()
      set({ user, loading: false, initialized: true })
    } catch {
      tokenStorage.clear()
      setWsToken(null)
      set({ token: null, loading: false, initialized: true })
    }
  },

  login: async (data: LoginRequest) => {
    set({ loading: true })
    const res = await authApi.login(data)
    tokenStorage.setToken(res.token)
    setWsToken(res.token)
    set({ user: res.user, token: res.token, loading: false })
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    tokenStorage.clear()
    setWsToken(null)
    set({ user: null, token: null })
  },

  setUser: (user: User) => {
    set({ user })
  },
}))
