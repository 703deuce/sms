import Link from 'next/link'
import { ChevronRight, Mic } from 'lucide-react'
import { Avatar, StatusPill } from './primitives'
import { outcomeTone, recoveryTone, type Call, type MissedCall } from '@/lib/data'
import { cn } from '@/lib/utils'

export const th = 'h-10 px-4 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
export const td = 'px-4 py-3 text-sm whitespace-nowrap'

export function CallsTable({ calls, showRecording = false }: { calls: Call[]; showRecording?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={th}>Caller</th>
            <th className={th}>{showRecording ? 'Date' : 'Time'}</th>
            <th className={th}>Duration</th>
            <th className={th}>Outcome</th>
            <th className={th}>Attention</th>
            {showRecording && <th className={th}>Recording</th>}
            <th className={th}>
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {calls.map((c) => (
            <tr key={c.id} className="group relative hover:bg-muted/40">
              <td className={td}>
                <Link href={`/voice/calls/${c.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                  <Avatar name={c.caller} />
                  <span className="flex flex-col">
                    <span className="font-medium">{c.caller}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{c.number}</span>
                  </span>
                </Link>
              </td>
              <td className={cn(td, 'text-muted-foreground')}>
                {showRecording ? `${c.date} · ${c.time}` : c.time}
              </td>
              <td className={cn(td, 'tabular-nums text-muted-foreground')}>{c.duration}</td>
              <td className={td}>
                <StatusPill tone={outcomeTone[c.outcome]}>{c.outcome}</StatusPill>
              </td>
              <td className={td}>
                {c.attention ? (
                  <StatusPill tone="warning" dot={false}>
                    {c.attention}
                  </StatusPill>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              {showRecording && (
                <td className={td}>
                  {c.recording ? (
                    <Mic className="size-4 text-muted-foreground" aria-label="Recording available" />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td className={cn(td, 'w-8 text-right')}>
                <ChevronRight className="ml-auto size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MissedCallsCompactTable({ rows }: { rows: MissedCall[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="border-b bg-muted/40">
          <tr>
            <th className={th}>Caller</th>
            <th className={th}>Missed</th>
            <th className={th}>Recovery</th>
            <th className={th}>Reply</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((m) => (
            <tr key={m.id} className="relative hover:bg-muted/40">
              <td className={td}>
                <Link href={`/mctb/missed-calls/${m.id}`} className="flex items-center gap-3 font-medium after:absolute after:inset-0">
                  <Avatar name={m.caller} className="size-7" />
                  {m.caller}
                </Link>
              </td>
              <td className={cn(td, 'text-muted-foreground')}>{m.missed}</td>
              <td className={td}>
                <StatusPill tone={recoveryTone[m.recovery]}>{m.recovery}</StatusPill>
              </td>
              <td className={cn(td, 'max-w-56 truncate text-muted-foreground')}>{m.reply ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
