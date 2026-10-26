import { NextResponse } from 'next/server'
import type { JSONContent } from '@tiptap/core'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { pmJsonToFountain, pmJsonToPlainTxt } from '@/lib/screenwriting/fountain/convert'
import { pmJsonToFdx } from '@/lib/screenwriting/fdx/serialize'
import { renderScriptPdf } from '@/lib/screenwriting/pdf/render'
import { renderCharacterSidesPdf } from '@/lib/screenwriting/pdf/character-sides'
import { pmJsonToDocxBuffer } from '@/lib/screenwriting/export/docx'
import { pmJsonToHighlandZip } from '@/lib/screenwriting/export/highland'
import { getScriptForOwner } from '@/lib/screenwriting/server/scripts'
import { assertFrozenExportAllowed, exportPresetForFrozenVersion } from '@/lib/screenwriting/versions/export-presets'
import type { EpisodeHeader } from '@/lib/screenwriting/tv/episode-header'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'fountain'
    const versionKind = url.searchParams.get('versionKind') ?? undefined
    const frozenExport = url.searchParams.get('frozenExport') === '1'
    if (versionKind && !assertFrozenExportAllowed(versionKind) && !frozenExport) {
      return NextResponse.json(
        { error: 'Frozen snapshot: use frozen export preset (frozenExport=1)' },
        { status: 403 },
      )
    }
    const preset = versionKind ? exportPresetForFrozenVersion(versionKind) : null
    const row = await getScriptForOwner(id, actor.id)
    if (!row?.pmJson) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const doc = row.pmJson as JSONContent
    const meta = (row.editorMeta ?? {}) as Record<string, unknown>
    const episodeHeader = meta.episodeHeader as EpisodeHeader | undefined
    if (format === 'fdx') {
      const xml = pmJsonToFdx(doc)
      return new NextResponse(xml, {
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.fdx"`,
        },
      })
    }
    if (format === 'character-sides') {
      const character = url.searchParams.get('character') || ''
      const pdf = await renderCharacterSidesPdf(doc, character, row.title || undefined)
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${character || 'character'}-sides.pdf"`,
        },
      })
    }
    if (format === 'pdf') {
      const watermark =
        url.searchParams.get('watermark') === '1'
          ? 'DRAFT'
          : preset?.watermark ?? (frozenExport ? 'FROZEN' : undefined)
      const pdf = await renderScriptPdf(doc, {
        title: row.title || 'Script',
        watermark,
        episodeHeader,
        sceneNumbers: url.searchParams.get('sceneNumbers') !== '0',
        includeTitlePage: url.searchParams.get('titlePage') !== '0',
      })
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.pdf"`,
        },
      })
    }
    if (format === 'docx') {
      const buf = await pmJsonToDocxBuffer(doc)
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.docx"`,
        },
      })
    }
    if (format === 'highland') {
      const buf = await pmJsonToHighlandZip(doc, row.title || 'Script')
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.highland"`,
        },
      })
    }
    if (format === 'txt') {
      const text = pmJsonToPlainTxt(doc)
      return new NextResponse(text, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${row.title || 'script'}.txt"`,
        },
      })
    }
    const fountain = pmJsonToFountain(doc)
    return new NextResponse(fountain, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${row.title || 'script'}.fountain"`,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
