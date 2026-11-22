import { agentLabErrorResponse, agentLabJson, AGENT_LAB_WORKDIR } from '@/lib/server/agent-lab'

export const dynamic = 'force-dynamic'

const EXT = ['mp4', 'mov', 'webm', 'm4v', 'mkv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'mp3', 'wav', 'm4a', 'srt', 'vtt', 'md', 'json', 'txt']

/** Recent media/output files the agent made under its project folder (newest first). */
export async function GET() {
  try {
    const names = EXT.map((e) => `-iname '*.${e}'`).join(' -o ')
    const command =
      `find ${AGENT_LAB_WORKDIR} -type f \\( ${names} \\) -not -path '*/node_modules/*' -not -path '*/.git/*' ` +
      `-not -path '*/frames/*' -not -name 'AGENTS.md' -printf '%T@\\t%s\\t%p\\n' 2>/dev/null | sort -rn | head -200`
    const out = await agentLabJson<{ stdout?: string | null }>('/api/bash/execute_bash_command', {
      method: 'POST',
      body: JSON.stringify({ command, timeout: 20 }),
    })
    const files = String(out.stdout ?? '')
      .split('\n')
      .filter(Boolean)
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
