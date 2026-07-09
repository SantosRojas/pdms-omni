const TOKEN_KEY = "authToken"
const USER_KEY = "authUser"

export const tokenStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  },

  removeToken(): void {
    localStorage.removeItem(TOKEN_KEY)
  },

  getUser(): unknown | null {
    try {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  setUser(user: unknown): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  removeUser(): void {
    localStorage.removeItem(USER_KEY)
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
}
