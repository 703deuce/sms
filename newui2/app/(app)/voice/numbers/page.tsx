import type { Metadata } from 'next'
import { Hash, Plus } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/app/primitives'
import { td, th } from '@/components/app/tables'
import { Button } from '@/components/ui/button'
import { numbers } from '@/lib/data'

export const metadata: Metadata = { title: 'Numbers' }

const messagingTone = (s: string) => (s === 'Registered' ? 'success' : s.startsWith('Pending') ? 'warning' : 'neutral')

export default function NumbersPage() {
  return (
    <>
      <PageHeader
        title="Numbers"
        description="Phone numbers on your account, their messaging registration, and line status."
        actions={
          <Button className="h-9">
            <Plus aria-hidden="true" /> Get a number
          </Button>
        }
      />
      <Panel bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>Number</th>
                <th className={th}>Label</th>
                <th className={th}>Type</th>
                <th className={th}>Messaging</th>
                <th className={th}>Line</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {numbers.map((n) => (
                <tr key={n.number} className="hover:bg-muted/40">
                  <td className={td}>
                    <span className="flex items-center gap-3 font-medium tabular-nums">
                      <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <Hash className="size-4" aria-hidden="true" />
                      </span>
                      {n.number}
                    </span>
                  </td>
                  <td className={td}>{n.label}</td>
                  <td className={`${td} text-muted-foreground`}>{n.type}</td>
                  <td className={td}>
                    <StatusPill tone={messagingTone(n.messaging)}>{n.messaging}</StatusPill>
                  </td>
                  <td className={td}>
                    <StatusPill tone={n.line === 'Active' ? 'success' : 'neutral'}>{n.line}</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
}
