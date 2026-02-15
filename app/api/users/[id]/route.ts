import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Validar formato UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}

// DELETE - Eliminar usuario
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
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
    return NextResponse.json(
      { 
        error: error.message || 'Error al eliminar usuario',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
