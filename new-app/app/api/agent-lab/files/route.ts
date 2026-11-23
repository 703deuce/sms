import { agentLabErrorResponse, agentLabJson, jobDir } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

const EXT = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'wav', 'm4a', 'srt', 'vtt', 'md', 'json', 'txt']

/** Recent media/output files in one conversation's job folder (newest first). */
export async function GET(request: Request) {
  try {
    const conversation = new URL(request.url).searchParams.get('conversation')
    if (!conversation) return Response.json({ files: [] })
    const dir = jobDir(conversation)
    if (!dir) return Response.json({ error: 'Invalid conversation id' }, { status: 400 })
    const names = EXT.map((e) => `-iname '*.${e}'`).join(' -o ')
    const command =
      `find ${dir} -type f \\( ${names} \\) -not -path '*/node_modules/*' -not -path '*/.git/*' ` +
      `-not -path '*/frames/*' -not -name 'AGENTS.md' -printf '%T@\\t%s\\t%p\\n' 2>/dev/null | sort -rn | head -200`
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
        return { path, name: path.split('/').pop() ?? path, size: Number(size) || 0, modifiedAt: new Date(Number(mtime) * 1000).toISOString() }
      })
    return Response.json({ files })
  } catch (err) {
    return agentLabErrorResponse(err)
  }
}
