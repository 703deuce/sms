import { Plus, RefreshCw } from 'lucide-react'
import { Page, PageHeader, Panel, Pill, type Tone } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { NUMBERS } from '@/newui-transplant/lib/sandbox-data'

export const metadata: Metadata = { title: 'Numbers' }

const messagingTone: Record<string, Tone> = { Registered: 'success', 'Pending review': 'warning', 'Not enabled': 'neutral' }

export function TransplantVoiceNumbersPage() {
  return (
    <Page>
      <PageHeader
        title="Numbers"
        description="Business lines, forwarded numbers, and text-back senders in this workspace."
        actions={
          <>
            <Button variant="outline">
              <RefreshCw /> Refresh list
            </Button>
            <Button>
              <Plus /> Add number
            </Button>
          </>
        }
      />
      <Panel bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-5 py-3 font-medium">Number</th>
                <th scope="col" className="px-3 py-3 font-medium">Label</th>
                <th scope="col" className="px-3 py-3 font-medium">Type</th>
                <th scope="col" className="px-3 py-3 font-medium">Messaging status</th>
                <th scope="col" className="px-3 py-3 font-medium">Line status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {NUMBERS.map((n) => (
                <tr key={n.number} className="hover:bg-muted/50">
                  <td className="px-5 py-3.5 font-mono text-sm">{n.number}</td>
                  <td className="px-3 py-3.5 font-medium">{n.label}</td>
                  <td className="px-3 py-3.5 text-muted-foreground">{n.type}</td>
                  <td className="px-3 py-3.5"><Pill tone={messagingTone[n.messaging]}>{n.messaging}</Pill></td>
                  <td className="px-3 py-3.5"><Pill tone={n.line === 'Active' ? 'success' : 'neutral'}>{n.line}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  )
}
