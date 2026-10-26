import { notFound } from 'next/navigation'
import { getPrisma } from '@/lib/server/db'
import { hashShareToken } from '@/lib/screenwriting/sharing/token'

export const dynamic = 'force-dynamic'

export default async function ShareScriptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const prisma = getPrisma()
  const link = await prisma.swShareLink.findFirst({
    where: { tokenHash: hashShareToken(token), revokedAt: null },
    include: { script: { include: { project: true } } },
  })
  if (!link || (link.expiresAt && link.expiresAt < new Date())) notFound()
  const script = link.script
  const pm = script.pmJson as { content?: { type?: string; content?: { text?: string }[] }[] } | null

  return (
    <main className="mx-auto max-w-3xl p-8 font-mono text-sm">
      <h1 className="mb-4 text-lg font-semibold">{script.title}</h1>
      <p className="mb-6 text-xs text-muted-foreground">Role: {link.role} — read-only share</p>
      <article className="space-y-4 whitespace-pre-wrap">
        {(pm?.content ?? []).map((block, i) => {
          if (block.type !== 'screenplayElement') return null
          const text = block.content?.map((c) => c.text ?? '').join('') ?? ''
          return <p key={i}>{text}</p>
        })}
      </article>
    </main>
  )
}
