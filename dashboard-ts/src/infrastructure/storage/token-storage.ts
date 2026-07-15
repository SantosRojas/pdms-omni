const TOKEN_KEY = "authToken"

export const tokenStorage = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY)
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token)
  },

  clear(): void {
    localStorage.removeItem(TOKEN_KEY)
  },
}
