import { agentLabErrorResponse, agentLabJson, jobDir } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

const EXT = [
  'mp4', 'mov', 'webm', 'm4v', 'mkv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'wav', 'm4a', 'srt', 'vtt', 'md', 'json', 'txt',
  'xlsx', 'xls', 'csv', 'pdf', 'docx', 'doc', 'pptx', 'ppt', 'zip',
]

/**
 * True for runner-internal paths that must not appear in the customer Files panel: log/ and work/ anywhere, and helpers/
 * except a background job's finished deliverables (helpers/<id>/out/...), which are listed so a job that has not
 * published to out/ yet still shows its results.
 */
function isInternalJobPath(dir: string, path: string): boolean {
  const rel = path.slice(dir.length).replace(/^\/+/, '')
  const parts = rel.split('/')
  if (parts.slice(0, -1).some((d) => d === 'log' || d === 'work')) return true
  if (parts[0] === 'helpers') return !(parts.length >= 4 && parts[2] === 'out' && !parts.slice(3).some((d) => d.startsWith('.')) && parts[parts.length - 1] !== 'result.md')
  return false
}

/** `report.helper-8c113c10.xlsx` (a publish collision copy) and `report.xlsx` are the same deliverable. */
const HELPER_COPY = /\.helper-[0-9a-f]{8}(-\d+)?(?=\.[^.]+$|$)/i

function deliverableKey(name: string, size: number): string {
  return `${name}|${size}`
}

/** Recent media/output files in one conversation's job folder (newest first). */
export async function GET(request: Request) {
  try {
    const conversation = new URL(request.url).searchParams.get('conversation')
    if (!conversation) return Response.json({ files: [] })
    const dir = jobDir(conversation)
    if (!dir) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const names = EXT.map((e) => `-iname '*.${e}'`).join(' -o ')
    // Media/document types anywhere, plus every file (any type) in the deliverables folder out/ and in background jobs'
    // helpers/<id>/out/. log/ and work/ stay hidden; helpers/ is otherwise hidden; dotfiles never show.
    const command =
      `find ${dir} -type f \\( ${names} -o -path '${dir}/out/*' -o -path '${dir}/helpers/*/out/*' \\) ` +
      `-not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/frames/*' -not -path '*/log/*' -not -path '*/work/*' ` +
      `-not \\( -path '${dir}/helpers/*' -not -path '${dir}/helpers/*/out/*' \\) -not -path '*/.*/*' -not -name '.*' -not -name 'AGENTS.md' ` +
      `-printf '%T@\\t%s\\t%p\\n' 2>/dev/null | sort -rn | head -300`
    const out = await agentLabJson<{ stdout?: string | null }>('/api/bash/execute_bash_command', {
      method: 'POST',
      body: JSON.stringify({ command, timeout: 20 }),
    })
    const files = String(out.stdout ?? '')
      .split('\n')
      .filter((line) => line.split('\t')[2]?.startsWith(`${dir}/`))
      .map((line) => {
        const [mtime, size, ...rest] = line.split('\t')
        const path = rest.join('\t')
        return { path, name: (path.split('/').pop() ?? path).replace(HELPER_COPY, ''), size: Number(size) || 0, modifiedAt: new Date(Number(mtime) * 1000).toISOString() }
      })
      .filter((f) => !isInternalJobPath(dir, f.path))
    // One entry per deliverable: the same file published from a helper into out/ (or saved under a .helper-<id> name) shows once,
    // keeping the copy in out/ under its plain name when there is one.
    const byKey = new Map<string, (typeof files)[number]>()
    const copy = (path: string) => HELPER_COPY.test(path) || path.includes('/helpers/')
    for (const f of files) {
      const key = deliverableKey(f.name, f.size)
      const kept = byKey.get(key)
      if (!kept || (copy(kept.path) && !copy(f.path))) byKey.set(key, kept ? { ...f, modifiedAt: kept.modifiedAt } : f)
    }
    const unique = [...byKey.values()]
    return Response.json({ files: unique.slice(0, 200) })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
