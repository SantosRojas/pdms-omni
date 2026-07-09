export type UserRole = "admin" | "operator" | "viewer"

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
}

export function canManageSerial(role: UserRole): boolean {
  return role === "admin" || role === "operator"
}

export function canAdmin(role: UserRole): boolean {
  return role === "admin"
}

export function canEdit(role: UserRole): boolean {
  return role === "admin" || role === "operator"
}
