import { MoreHorizontal, Plus } from 'lucide-react'
import { Initials, Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'

export const metadata: Metadata = { title: 'Notifications' }

const RECIPIENTS = [
  { name: 'Dana Whitaker', email: 'dana@northsideplumbing.com', mobile: '(512) 555-0161' },
  { name: 'Jake Morales', email: 'jake@northsideplumbing.com', mobile: '(512) 555-0170' },
  { name: 'Front office', email: 'office@northsideplumbing.com', mobile: '—' },
]

const EVENTS = [
  { label: 'Customer replied', email: true, sms: true },
  { label: 'Needs reply (15 min)', email: true, sms: true },
  { label: 'New voicemail', email: true, sms: false },
  { label: 'Delivery failure', email: true, sms: false },
  { label: 'Forwarding stopped working', email: true, sms: true },
]

export function TransplantMctbSetupNotificationsPage() {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Team recipients" action={<Button size="sm" variant="outline"><Plus /> Add recipient</Button>} bodyClassName="p-0">
        <ul className="divide-y">
          {RECIPIENTS.map((r) => (
            <li key={r.name} className="flex items-center gap-3 px-5 py-3">
              <Initials name={r.name} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.email} · {r.mobile}</p>
              </div>
              <Button size="icon-sm" variant="ghost" aria-label={`Edit ${r.name}`}><MoreHorizontal /></Button>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Events" description="Choose how the team is notified" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 font-medium">Event</th>
              <th scope="col" className="w-20 px-3 py-2.5 text-center font-medium">Email</th>
              <th scope="col" className="w-20 px-5 py-2.5 text-center font-medium">SMS</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {EVENTS.map((e) => (
              <tr key={e.label}>
                <td className="px-5 py-3">{e.label}</td>
                <td className="px-3 py-3 text-center"><Checkbox defaultChecked={e.email} aria-label={`${e.label} by email`} /></td>
                <td className="px-5 py-3 text-center"><Checkbox defaultChecked={e.sms} aria-label={`${e.label} by SMS`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  )
}
