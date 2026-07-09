import type { User, CreateUserRequest, UpdateUserRequest } from "../entities/user"

export interface UserRepository {
  list(): Promise<User[]>
  create(data: CreateUserRequest): Promise<User>
  update(id: number, data: UpdateUserRequest): Promise<User>
  remove(id: number): Promise<void>
}
