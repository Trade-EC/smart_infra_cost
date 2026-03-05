import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/roles'

// Validar formato UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// Verificar que el usuario sea Owner
async function requireOwnerInAPI() {
  try {
    const supabase = await createClient()
    
    // Primero verificar si hay una sesión válida
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    // Si no hay sesión o hay error, no intentar obtener el usuario
    if (sessionError || !session) {
      throw new Error('No autenticado: Sesión no válida')
    }
    
    // Si hay sesión, obtener el usuario
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Si hay error de autenticación (como refresh token inválido), retornar error 401
    if (error) {
      // Si es un error de refresh token, mensaje más claro
      if (error.message?.includes('refresh') || error.message?.includes('token')) {
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
      }
      throw new Error('No autenticado: ' + error.message)
    }
    
    if (!user) {
      throw new Error('No autenticado')
    }
    
    if (!isOwner(user)) {
      throw new Error('No autorizado: Solo los Owners pueden acceder a esta funcionalidad')
    }
    
    return user
  } catch (error: any) {
    // Si es un error de refresh token, lanzar un error más claro
    if (error?.message?.includes('refresh') || error?.message?.includes('token') || error?.message?.includes('Sesión expirada')) {
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.')
    }
    throw error
  }
}

// PATCH - Actualizar email y/o rol de usuario
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwnerInAPI()

    const { id } = await context.params
    let userId = id
    if (!userId) {
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      userId = pathParts[pathParts.length - 1]
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'ID de usuario inválido o no proporcionado' },
        { status: 400 }
      )
    }

    const cleanedId = userId.trim()
    const decodedId = decodeURIComponent(cleanedId)

    if (!isValidUUID(decodedId)) {
      return NextResponse.json(
        { error: `ID de usuario no es un UUID válido. Recibido: "${decodedId}"` },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email, role } = body

    if (!email && !role) {
      return NextResponse.json(
        { error: 'Debes enviar al menos email o role para actualizar' },
        { status: 400 }
      )
    }

    if (role && role !== 'owner' && role !== 'admin' && role !== 'reports') {
      return NextResponse.json(
        { error: 'Rol inválido. Debe ser "owner", "admin" o "reports"' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { data: { user: currentUser }, error: getUserError } =
      await adminClient.auth.admin.getUserById(decodedId)

    if (getUserError || !currentUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
    }

    const updatePayload: { email?: string; user_metadata?: object } = {}
    if (email) updatePayload.email = email.trim()
    if (role) {
      updatePayload.user_metadata = {
        ...currentUser.user_metadata,
        role,
      }
    }

    const { data, error } = await adminClient.auth.admin.updateUserById(
      decodedId,
      updatePayload
    )

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Error al actualizar el usuario' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role || 'admin',
    })
  } catch (error: any) {
    console.error('Error en PATCH /api/users/[id]:', error)

    if (error.message?.includes('No autenticado') || error.message?.includes('Sesión expirada')) {
      return NextResponse.json(
        { error: error.message || 'No autenticado' },
        { status: 401 }
      )
    }

    if (error.message?.includes('No autorizado')) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: error.message || 'Error al actualizar el usuario' },
      { status: 500 }
    )
  }
}

// DELETE - Eliminar usuario
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Verificar que el usuario sea Owner
    await requireOwnerInAPI()
    
    // Obtener el ID de los parámetros (Next.js 15+ requiere await)
    const { id } = await context.params
    
    // Si no viene en params, intentar obtenerlo de la URL
    let userId = id
    if (!userId) {
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      userId = pathParts[pathParts.length - 1]
    }
    
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'ID de usuario inválido o no proporcionado' },
        { status: 400 }
      )
    }

    // Limpiar y decodificar el ID
    const cleanedId = userId.trim()
    const decodedId = decodeURIComponent(cleanedId)

    // Validar que sea un UUID válido
    if (!isValidUUID(decodedId)) {
      return NextResponse.json(
        { error: `ID de usuario no es un UUID válido. Recibido: "${decodedId}"` },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient.auth.admin.deleteUser(decodedId)

    if (error) {
      console.error('Error al eliminar usuario de Supabase:', error)
      return NextResponse.json(
        { error: error.message || 'Error al eliminar usuario' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error en DELETE /api/users/[id]:', error)
    
    // Si es un error de autenticación, retornar 401
    if (error.message?.includes('No autenticado') || error.message?.includes('Sesión expirada')) {
      return NextResponse.json(
        { error: error.message || 'No autenticado' },
        { status: 401 }
      )
    }
    
    // Si es un error de autorización, retornar 403
    if (error.message?.includes('No autorizado')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      )
    }
    
    return NextResponse.json(
      { 
        error: error.message || 'Error al eliminar usuario',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
