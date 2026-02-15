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
  { params }: { params: { id: string } }
) {
  try {
    // Obtener el ID de los parámetros
    let id = params?.id
    
    // Si no viene en params, intentar obtenerlo de la URL
    if (!id) {
      const url = new URL(request.url)
      const pathParts = url.pathname.split('/')
      id = pathParts[pathParts.length - 1]
    }
    
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'ID de usuario inválido o no proporcionado' },
        { status: 400 }
      )
    }

    // Limpiar y decodificar el ID
    const cleanedId = id.trim()
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
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al eliminar usuario: ' + error.message },
      { status: 500 }
    )
  }
}
