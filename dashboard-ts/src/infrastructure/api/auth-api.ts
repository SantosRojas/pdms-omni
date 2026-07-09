import type { AuthRepository } from "@/domain/repositories/auth-repository"
import type { LoginRequest, LoginResponse, User } from "@/domain/entities/user"
import { apiClient } from "./client"

export const authApi: AuthRepository = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const { data: res } = await apiClient.post<LoginResponse>("/api/auth/login", data)
    return res
  },

  async logout(): Promise<void> {
    await apiClient.post("/api/auth/logout")
  },

  async me(): Promise<User> {
    const { data } = await apiClient.get<User>("/api/auth/me")
    return data
  },
}
