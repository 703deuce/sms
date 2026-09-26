import type { Metadata } from 'next'
import { FieldRow, Panel } from '@/components/app/kit'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SaveBar } from '@/components/app/save-bar'

export const metadata: Metadata = { title: 'Recovery' }

const TRIGGERS = [
  { label: 'No answer', on: true },
  { label: 'Busy', on: true },
  { label: 'Rejected / declined', on: true },
  { label: 'Unreachable', on: true },
  { label: 'After voicemail', on: true },
  { label: 'Blocked caller ID', on: false },
]

function Choice({ id, options, defaultValue }: { id: string; options: string[]; defaultValue: string }) {
  return (
    <Select defaultValue={defaultValue} items={options.map((o) => ({ label: o, value: o }))}>
      <SelectTrigger aria-label={id} className="w-40"><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

export default function RecoverySetupPage() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Recovery triggers" description="Send a recovery text when a call ends like this">
        <ul className="grid gap-3 sm:grid-cols-2">
          {TRIGGERS.map((t) => (
            <li key={t.label}>
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox defaultChecked={t.on} /> {t.label}
              </label>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Pause recovery">
        <p className="mb-3 text-sm text-muted-foreground">Recovery is running. Pause temporarily or indefinitely.</p>
        <div className="flex flex-wrap gap-2">
          {['1 hour', 'Until tomorrow', '1 week', 'Indefinitely'].map((p) => (
            <Button key={p} variant="outline" size="sm">{p}</Button>
          ))}
        </div>
      </Panel>

      <Panel title="Timing & follow-up" className="lg:col-span-2">
        <div className="divide-y">
          <FieldRow label="Recovery delay" description="Wait before sending, in case your team calls back first">
            <Choice id="Recovery delay" options={['Immediately', '30 seconds', '1 minute', '5 minutes']} defaultValue="30 seconds" />
          </FieldRow>
          <FieldRow label="Cooldown" description="Don’t text the same caller again within this window">
            <Choice id="Cooldown" options={['1 hour', '12 hours', '24 hours', '7 days']} defaultValue="24 hours" />
          </FieldRow>
          <FieldRow label="Max automated messages" description="Per missed call, before a human takes over">
            <Choice id="Max automated messages" options={['1', '2', '3', '5']} defaultValue="3" />
          </FieldRow>
        </div>
        <div className="mt-4 flex justify-end"><SaveBar /></div>
      </Panel>
    </div>
  )
}
