export type UserRole = "admin" | "operator" | "viewer"

export function canManageSerial(role: UserRole): boolean {
  return role === "admin" || role === "operator"
}

export function canAdmin(role: UserRole): boolean {
  return role === "admin"
}

export function canEdit(role: UserRole): boolean {
  return role === "admin" || role === "operator"
}
