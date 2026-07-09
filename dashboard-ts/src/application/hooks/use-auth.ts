import { useAuthStore } from "@/application/stores/auth-store"
import {
  canManageSerial as checkCanManage,
  canAdmin as checkCanAdmin,
  canEdit as checkCanEdit,
} from "@/domain/value-objects/role"

export function useAuth() {
  const store = useAuthStore()

  return {
    user: store.user,
    token: store.token,
    loading: store.loading,
    initialized: store.initialized,
    isAuthenticated: !!store.user,
    login: store.login,
    logout: store.logout,
    canManageSerial: store.user ? checkCanManage(store.user.role as never) : false,
    canAdmin: store.user ? checkCanAdmin(store.user.role as never) : false,
    canEdit: store.user ? checkCanEdit(store.user.role as never) : false,
  }
}
