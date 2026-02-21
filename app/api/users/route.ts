import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { isOwner } from '@/lib/roles'

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

// GET - Listar usuarios
export async function GET() {
  try {
    // Verificar que el usuario sea Owner
    await requireOwnerInAPI()
    
    const adminClient = createAdminClient()
    
    const { data: { users }, error } = await adminClient.auth.admin.listUsers()

    if (error) {
      console.error('Error al listar usuarios:', error)
      return NextResponse.json(
        { error: error.message || 'Error al listar usuarios' },
        { status: 500 }
      )
    }

    // Transformar los datos para incluir solo lo necesario
    const usersList = users.map((user) => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      role: user.user_metadata?.role || 'admin', // Incluir el rol
    }))

    return NextResponse.json(usersList)
  } catch (error: any) {
    console.error('Error en GET /api/users:', error)
    
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
        error: error.message || 'Error al listar usuarios',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// POST - Crear usuario
export async function POST(request: NextRequest) {
  try {
    // Verificar que el usuario sea Owner
    await requireOwnerInAPI()
    
    const body = await request.json()
    const { email, password, role } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 8 caracteres' },
        { status: 400 }
      )
    }

    // Validar el rol
    const userRole = role === 'owner' ? 'owner' : 'admin'

    const adminClient = createAdminClient()

    // Crear usuario con la opción de que deba cambiar la contraseña en el primer login
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar el email automáticamente
      user_metadata: {
        role: userRole,
        must_change_password: true, // Marcar que debe cambiar la contraseña
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: data.user.id,
      email: data.user.email,
      created_at: data.user.created_at,
    })
  } catch (error: any) {
    console.error('Error en POST /api/users:', error)
    
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
        error: error.message || 'Error al crear usuario',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
