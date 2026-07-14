import type { LoginRequest, LoginResponse, User } from "../entities/user"

export interface AuthRepository {
  login(data: LoginRequest): Promise<LoginResponse>
  loginWithCode(code: string): Promise<LoginResponse>
  logout(): Promise<void>
  me(): Promise<User>
}
