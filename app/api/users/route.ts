import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET - Listar usuarios
export async function GET() {
  try {
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
    }))

    return NextResponse.json(usersList)
  } catch (error: any) {
    console.error('Error en GET /api/users:', error)
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
    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email y contraseña son requeridos' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La contraseña debe tener al menos 6 caracteres' },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Crear usuario con la opción de que deba cambiar la contraseña en el primer login
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmar el email automáticamente
      user_metadata: {
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
    return NextResponse.json(
      { 
        error: error.message || 'Error al crear usuario',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
