import Link from 'next/link'
import { Initials } from '@/newui-transplant/components/app/kit'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { RecoveryPill } from '@/newui-transplant/components/app/status'
import type { MissedCall } from '@/newui-transplant/lib/view-models'
import { cn } from '@/lib/utils'

export const th = 'h-10 px-4 text-left text-xs font-medium text-muted-foreground whitespace-nowrap'
export const td = 'px-4 py-3 text-sm whitespace-nowrap'

export function MissedCallsCompactTable({ rows }: { rows: MissedCall[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className={OPUS_TABLE_HEAD}>
          <tr>
            <th scope="col" className={th}>Caller</th>
            <th scope="col" className={th}>Missed</th>
            <th scope="col" className={th}>Recovery</th>
            <th scope="col" className={th}>Reply</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((m) => (
            <tr key={m.id} className="group relative hover:bg-muted/40">
              <td className={td}>
                <Link
                  href={`/mctb/missed-calls/${m.id}`}
                  className="flex items-center gap-3 font-medium after:absolute after:inset-0"
                >
                  <Initials name={m.caller} className="size-7" />
                  <span className="min-w-0">
                    <span className="block truncate">{m.caller}</span>
                    <span className="block font-mono text-xs font-normal text-muted-foreground tabular-nums">{m.phone}</span>
                  </span>
                </Link>
              </td>
              <td className={cn(td, 'text-muted-foreground')}>{m.missed}</td>
              <td className={td}>
                <RecoveryPill status={m.recovery} />
              </td>
              <td className={cn(td, 'max-w-56 truncate text-muted-foreground')}>{m.reply ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
