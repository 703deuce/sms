'use client'

export function ToolCallCard({ summary, status = 'done' }: { summary: string; status?: 'done' | 'pending' | 'paid' }) {
  return (
    <div className="rounded border border-border bg-muted/40 px-2 py-1 text-xs">
      <span className="font-medium">{status === 'paid' ? '💳 ' : ''}</span>
      {summary}
    </div>
  )
}
