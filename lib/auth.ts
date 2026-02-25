import { createClient } from './supabase/server'
import { redirect } from 'next/navigation'
import { isOwner, type UserRole } from './roles'

export async function getSession() {
  try {
    const supabase = await createClient()
    const { data: { session }, error } = await supabase.auth.getSession()
    
    // Si hay error o no hay sesión, retornar null
    if (error || !session) {
      return null
    }
    
    return session
  } catch (error) {
    // Si hay cualquier error, retornar null para evitar bucles
    console.error('Error al obtener sesión:', error)
    return null
  }
}

export async function getUser() {
  try {
    const supabase = await createClient()
    
    // Primero intentar obtener la sesión para verificar si existe
    const { data: { session } } = await supabase.auth.getSession()
    
    // Si no hay sesión, no intentar obtener el usuario (evita error de refresh token)
    if (!session) {
      return null
    }
    
    // Si hay sesión, obtener el usuario
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Si hay error o no hay usuario, retornar null
    if (error || !user) {
      // Si el error es de refresh token, no loguearlo como error crítico
      if (error?.message?.includes('refresh') || error?.message?.includes('token')) {
        return null
      }
      return null
    }
    
    return user
  } catch (error) {
    // Si hay cualquier error, retornar null para evitar bucles
    // No loguear errores de refresh token como errores críticos
    if (error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message)
      if (!errorMessage.includes('refresh') && !errorMessage.includes('token')) {
        console.error('Error al obtener usuario:', error)
      }
    }
    return null
  }
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }
  return user
}

// Requerir que el usuario sea Owner
export async function requireOwner() {
  const user = await requireAuth()
  if (!isOwner(user)) {
    redirect('/app/reports')
  }
  return user
}


