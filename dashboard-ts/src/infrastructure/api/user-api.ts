import type { UserRepository } from "@/domain/repositories/user-repository"
import type { User, CreateUserRequest, UpdateUserRequest } from "@/domain/entities/user"
import { apiClient } from "./client"

export const userApi: UserRepository = {
  async list(): Promise<User[]> {
    const { data } = await apiClient.get<User[]>("/api/users")
    return data
  },

  async create(req: CreateUserRequest): Promise<User> {
    const { data } = await apiClient.post<User>("/api/users", req)
    return data
  },

  async update(id: number, req: UpdateUserRequest): Promise<User> {
    const { data } = await apiClient.put<User>(`/api/users/${id}`, req)
    return data
  },

  async remove(id: number): Promise<void> {
    await apiClient.delete(`/api/users/${id}`)
  },
}
