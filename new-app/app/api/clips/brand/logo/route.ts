import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { brandLogoKey, getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const ALLOWED = new Set(['image/png', 'image/svg+xml'])

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const key = new URL(request.url).searchParams.get('key')
    if (!key || !key.startsWith(`brand/${workspaceId}/`)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    const storage = getClipStorage()
    const url = await storage.createSignedDownloadUrl(key, 3600)
    return NextResponse.json({ data: { url } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file required' }, { status: 400 })
    }
    const mime = file.type || 'application/octet-stream'
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: 'PNG or SVG only' }, { status: 400 })
    }
    const ext = mime === 'image/svg+xml' ? 'svg' : 'png'
    const key = brandLogoKey(workspaceId, ext)
    const buf = Buffer.from(await file.arrayBuffer())
    const cfg = await import('@/lib/storage/supabase-driver').then((m) => m.getSupabaseStorageConfig())
    if (!cfg) throw new Error('Storage not configured')
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
    const { error } = await supabase.storage.from(cfg.bucket).upload(key, buf, {
      contentType: mime,
      upsert: true,
    })
    if (error) throw new Error(error.message)

    const prisma = getPrisma()
    const row = await prisma.clipBrandTemplate.findFirst({ where: { workspaceId, isDefault: true } })
    if (row) {
      await prisma.clipBrandTemplate.update({ where: { id: row.id }, data: { logoKey: key } })
    }

    return NextResponse.json({ data: { logoKey: key } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
