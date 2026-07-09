import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from "axios"
import { tokenStorage } from "@/infrastructure/storage/token-storage"

const BASE_URL = import.meta.env.VITE_API_URL || ""

let wsToken: string | null = null

export function setWsToken(token: string | null) {
  wsToken = token
}

export function getWsToken(): string | null {
  return wsToken
}

function authInterceptor(config: InternalAxiosRequestConfig) {
  const token = tokenStorage.getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

function errorInterceptor(error: unknown) {
  if (axios.isAxiosError(error) && error.response?.status === 401) {
    tokenStorage.clear()
    setWsToken(null)
    window.dispatchEvent(new CustomEvent("auth:expired"))
  }
  return Promise.reject(error)
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
})

apiClient.interceptors.request.use(authInterceptor)
apiClient.interceptors.response.use((res) => res, errorInterceptor)
