import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { requireSwActor } from '@/lib/screenwriting/server/actor'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'
import { parseFdx } from '@/lib/screenwriting/fdx/parse'
import { getScriptForOwner, saveScriptPmJson } from '@/lib/screenwriting/server/scripts'
import { fdxImportStats } from '@/lib/screenwriting/import/fdx-stats'
import { warningsFromFdxParse, type ImportWarning } from '@/lib/screenwriting/import/warnings'
import { appendPmJson } from '@/lib/screenwriting/import/merge-doc'
import { getPrisma } from '@/lib/server/db'
import { createSwScriptInProject } from '@/lib/screenwriting/server/projects'
import type { JSONContent } from '@tiptap/core'

const bodySchema = z.object({
  format: z.enum(['fountain', 'fdx']),
  text: z.string().min(1).max(8_000_000),
  mode: z.enum(['replace', 'append', 'new']).default('replace'),
})

function parseImport(text: string, format: 'fountain' | 'fdx'): { pmJson: JSONContent; warnings: ImportWarning[]; titlePage?: Record<string, unknown> } {
  let warnings: ImportWarning[] = []
  if (format === 'fdx') {
    const parsed = parseFdx(text)
    warnings = warningsFromFdxParse(fdxImportStats(text))
    return { pmJson: parsed.pmJson as JSONContent, warnings, titlePage: parsed.titlePage }
  }
  const pmJson = fountainToPmJson(text) as JSONContent
  if (!(pmJson.content?.length ?? 0)) {
    warnings.push({ code: 'empty', message: 'Fountain produced no blocks', severity: 'warn' })
  }
  return { pmJson, warnings }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireSwActor()
    const { id } = await ctx.params
    const body = bodySchema.parse(await request.json())
    const row = await getScriptForOwner(id, actor.id)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { pmJson: imported, warnings, titlePage } = parseImport(body.text, body.format)
    const prisma = getPrisma()

    if (body.mode === 'new') {
      const created = await createSwScriptInProject(row.projectId, actor.id, {
        title: `Import ${new Date().toISOString().slice(0, 10)}`,
        pmJson: imported,
        editorMeta: titlePage ? { titlePage } : undefined,
      })
      return NextResponse.json({
        data: { ok: true, warnings, scriptId: created.id, mode: body.mode },
      })
    }

    const current = (row.pmJson ?? { type: 'doc', content: [] }) as JSONContent
    let nextDoc = imported
    if (body.mode === 'append') {
      nextDoc = appendPmJson(current, imported)
    } else {
      if (row.pmJson) {
        await prisma.swVersion.create({
          data: {
            scriptId: id,
            kind: 'PRE_IMPORT',
            label: `Pre-import ${body.format}`,
            pmJson: row.pmJson,
            yState: row.yState ?? Buffer.alloc(0),
            pageCount: row.pageCount,
            createdById: actor.id,
          },
        })
      }
    }

    await saveScriptPmJson(id, actor.id, nextDoc)
    if (titlePage && body.mode === 'replace') {
      const meta = (row.editorMeta ?? {}) as Record<string, unknown>
      await prisma.swScript.update({
        where: { id },
        data: { editorMeta: { ...meta, titlePage } as Prisma.InputJsonValue },
      })
    }

    return NextResponse.json({ data: { ok: true, warnings, mode: body.mode } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
