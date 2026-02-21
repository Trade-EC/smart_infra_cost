// Tipos de roles disponibles
export type UserRole = 'owner' | 'admin'

// Verificar si el usuario tiene un rol específico
export function hasRole(user: any, role: UserRole): boolean {
  if (!user || !user.user_metadata) {
    return false
  }
  
  const userRole = user.user_metadata.role as UserRole
  return userRole === role
}

// Verificar si el usuario es Owner
export function isOwner(user: any): boolean {
  return hasRole(user, 'owner')
}

// Verificar si el usuario es Admin
export function isAdmin(user: any): boolean {
  return hasRole(user, 'admin')
}

// Verificar si el usuario es Owner o Admin
export function isOwnerOrAdmin(user: any): boolean {
  return isOwner(user) || isAdmin(user)
}

// Obtener el rol del usuario
export function getUserRole(user: any): UserRole | null {
  if (!user || !user.user_metadata) {
    return null
  }
  
  return (user.user_metadata.role as UserRole) || null
}
