import Link from 'next/link'
import { ChevronRight, Mic } from 'lucide-react'
import { Initials, Pill } from '@/newui-transplant/components/app/kit'
import { OutcomePill } from '@/newui-transplant/components/app/status'
import type { VoiceCall } from '@/newui-transplant/lib/view-models'

export function RecentCallsTable({ calls, showRecording = false }: { calls: VoiceCall[]; showRecording?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th scope="col" className="px-5 py-2.5 font-medium">Caller</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Time</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Duration</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Outcome</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Attention</th>
            {showRecording ? <th scope="col" className="px-3 py-2.5 font-medium"><span className="sr-only">Recording</span></th> : null}
            <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {calls.map((call) => (
            <tr key={call.id} className="group relative transition-colors hover:bg-muted/50">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Initials name={call.caller} />
                  <div className="min-w-0">
                    <Link href={`/voice/calls/${call.id}`} className="font-medium after:absolute after:inset-0">
                      {call.caller}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">{call.phone}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                {call.date} · {call.time}
              </td>
              <td className="px-3 py-3 font-mono text-xs tabular-nums">{call.duration}</td>
              <td className="px-3 py-3"><OutcomePill outcome={call.outcome} /></td>
              <td className="px-3 py-3">
                {call.attention ? <Pill tone="warning">{call.attention}</Pill> : <span className="text-muted-foreground">—</span>}
              </td>
              {showRecording ? (
                <td className="px-3 py-3">
                  {call.recording ? <Mic className="size-4 text-muted-foreground" aria-label="Recording available" /> : null}
                </td>
              ) : null}
              <td className="px-3 py-3 text-muted-foreground">
                <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
