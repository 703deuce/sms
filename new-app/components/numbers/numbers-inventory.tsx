'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRightLeft,
  CircleHelp,
  Hash,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  ShoppingBag,
  Trash2,
  Unplug,
  Workflow,
  PhoneForwarded,
  FileText,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { EmptyState, IconTile, Panel, Stat } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'
import { SearchInput, SegmentedFilter, SimpleSelect } from '@/components/app/filters'
import { useNumbers } from '@/components/providers/numbers-provider'
import {
  CONNECTION_STATUS,
  FORWARDING_LABEL,
  OWNED_STATUS,
  PORT_STATUS,
  PRODUCT_LABEL,
  type NumberProduct,
  type OwnedNumber,
  type ExternalConnection,
} from '@/lib/numbers'
import { formatPhone, formatWhen } from '@/lib/format'
import { CapabilityChips, ProductChips } from './number-ui'
import { AssignmentSheet } from './assignment-sheet'
import { DisconnectDialog, ReleaseDialog, RenameDialog } from './number-dialogs'

type Tab = 'owned' | 'connected' | 'porting'

export function NumbersInventory() {
  const { owned, connections, ports, platform, loading, error, refresh } = useNumbers()
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const tab = (params.get('tab') as Tab) || 'owned'
  const setTab = (t: Tab) => router.replace(`${pathname}?tab=${t}`, { scroll: false })
  const [help, setHelp] = useState(false)

  const activeOwned = owned.filter((n) => n.status === 'active').length
  const unassigned = owned.filter((n) => n.status === 'active' && !n.assignments.length).length
  const attention = connections.filter((c) => c.status !== 'verified').length + ports.filter((p) => p.status === 'info_needed' || p.status === 'rejected').length

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <Panel className="border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Numbers unavailable</p>
          <p className="text-muted-foreground mt-1">{error}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void refresh()}>
            Retry
          </Button>
        </Panel>
      ) : null}
      {platform ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-medium">{platform.label}</p>
            <p className="text-muted-foreground text-sm tabular-nums">{formatPhone(platform.number)}</p>
          </div>
          <StatusBadge tone="success">Platform</StatusBadge>
        </Panel>
      ) : null}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owned numbers" value={loading ? '…' : owned.length} hint={loading ? 'Loading…' : `${activeOwned} active`} icon={Hash} />
        <Stat label="Connected lines" value={connections.length} hint="Forwarded from your carrier" icon={PhoneForwarded} />
        <Stat label="Port requests" value={ports.filter((p) => p.status !== 'completed').length} hint="In progress" icon={ArrowRightLeft} />
        <Stat
          label="Needs attention"
          value={attention + unassigned}
          hint={`${unassigned} unassigned · ${attention} lines/ports`}
          tone={attention + unassigned ? 'warning' : 'success'}
          icon={BadgeCheck}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="owned">Owned <span className="ml-1 text-muted-foreground tabular-nums">{owned.length}</span></TabsTrigger>
            <TabsTrigger value="connected">Connected lines <span className="ml-1 text-muted-foreground tabular-nums">{connections.length}</span></TabsTrigger>
            <TabsTrigger value="porting">Porting <span className="ml-1 text-muted-foreground tabular-nums">{ports.length}</span></TabsTrigger>
          </TabsList>
          <Button variant="ghost" size="sm" onClick={() => setHelp(true)}>
            <CircleHelp data-icon="inline-start" />
            Buy, connect or port?
          </Button>
        </div>

        <TabsContent value="owned"><OwnedTable numbers={owned} /></TabsContent>
        <TabsContent value="connected"><ConnectionsTable connections={connections} /></TabsContent>
        <TabsContent value="porting">
          <Panel bodyClassName="p-0">
            {ports.length === 0 ? (
              <EmptyState icon={ArrowRightLeft} title="No port requests" description="Move a number you own elsewhere to Transovo." action={<Button render={<Link href="/app/numbers/port" />}>Start a port</Button>} />
            ) : (
              <ul className="divide-y">
                {ports.map((p) => (
                  <li key={p.id}>
                    <Link href={`/app/numbers/ports/${p.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                      <IconTile icon={ArrowRightLeft} tone={p.status === 'info_needed' ? 'warning' : 'default'} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="font-medium tabular-nums">{formatPhone(p.number)}</span>
                        <span className="text-xs text-muted-foreground">From {p.carrierFrom} · {p.reference ?? 'Not submitted'} · Started {formatWhen(p.requestedAt)}</span>
                      </div>
                      <StatusBadge tone={PORT_STATUS[p.status].tone}>{PORT_STATUS[p.status].label}</StatusBadge>
                      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <Sheet open={help} onOpenChange={setHelp}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Which option is right?</SheetTitle>
            <SheetDescription>Three ways to get a line working with Transovo.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-3 px-4 pb-6">
            {[
              { icon: ShoppingBag, t: 'Buy a new number', d: 'Instant. We own it, so voice, SMS and caller ID all work everywhere. Best for new lines or campaigns.', href: '/app/numbers/new' },
              { icon: Link2, t: 'Connect a number you keep', d: 'Keep your carrier. You set up call forwarding; AI Receptionist and MCTB answer forwarded calls. Outbound and SMS stay with your carrier.', href: '/app/numbers/connect' },
              { icon: ArrowRightLeft, t: 'Port your number', d: 'Move ownership to Transovo. Takes days to weeks and needs carrier account details. Best when you want everything in one place.', href: '/app/numbers/port' },
            ].map((o) => (
              <Link key={o.t} href={o.href} className="flex gap-3 rounded-xl p-4 surface-raised transition-shadow hover:shadow-md">
                <IconTile icon={o.icon} tone="primary" />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{o.t}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{o.d}</span>
                </span>
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function OwnedTable({ numbers }: { numbers: OwnedNumber[] }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'local' | 'toll_free'>('all')
  const [product, setProduct] = useState<'all' | NumberProduct | 'none'>('all')
  const [rename, setRename] = useState<OwnedNumber | null>(null)
  const [assign, setAssign] = useState<OwnedNumber | null>(null)
  const [release, setRelease] = useState<OwnedNumber | null>(null)

  const rows = useMemo(
    () =>
      numbers.filter((n) => {
        const text = `${n.nickname} ${n.number} ${formatPhone(n.number)} ${n.region}`.toLowerCase()
        if (q && !text.includes(q.toLowerCase())) return false
        if (type !== 'all' && n.numberType !== type) return false
        if (product === 'none' && n.assignments.length) return false
        if (product !== 'all' && product !== 'none' && !n.assignments.some((a) => a.product === product)) return false
        return true
      }),
    [numbers, q, type, product],
  )

  return (
    <Panel bodyClassName="p-0">
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search number, nickname, city" className="w-full sm:w-64" />
        <SegmentedFilter
          label="Number type"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'All' },
            { value: 'local', label: 'Local' },
            { value: 'toll_free', label: 'Toll-free' },
          ]}
        />
        <SimpleSelect
          label="Product"
          value={product}
          onChange={setProduct}
          className="w-44"
          options={[
            { value: 'all', label: 'Any product' },
            { value: 'none', label: 'Unassigned' },
            ...(Object.keys(PRODUCT_LABEL) as NumberProduct[]).map((p) => ({ value: p, label: PRODUCT_LABEL[p] })),
          ]}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Hash}
          title={numbers.length ? 'No numbers match' : 'No numbers yet'}
          description={numbers.length ? 'Try clearing filters.' : 'Buy a number to start taking calls.'}
          action={numbers.length ? <Button variant="outline" onClick={() => { setQ(''); setType('all'); setProduct('all') }}>Clear filters</Button> : <Button render={<Link href="/app/numbers/new" />}>Get a number</Button>}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Number</th>
                <th className="px-4 py-2.5 font-medium">Capabilities</th>
                <th className="px-4 py-2.5 font-medium">Assigned to</th>
                <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Routes to</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="w-10 px-2"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((n) => (
                <tr key={n.id} className="group transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/app/numbers/${n.id}`} className="flex items-center gap-3">
                      <IconTile icon={Hash} size="sm" tone={n.defaultCallerId ? 'primary' : 'default'} />
                      <span className="flex flex-col">
                        <span className="font-medium tabular-nums group-hover:text-primary">{formatPhone(n.number)}</span>
                        <span className="text-xs text-muted-foreground">
                          {n.nickname} · {n.numberType === 'toll_free' ? 'Toll-free' : n.region}
                          {n.defaultCallerId && ' · Default caller ID'}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3"><CapabilityChips caps={n.capabilities} /></td>
                  <td className="px-4 py-3"><ProductChips products={n.assignments.map((a) => a.product)} /></td>
                  <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">{n.destination}</td>
                  <td className="px-4 py-3"><StatusBadge tone={OWNED_STATUS[n.status].tone}>{OWNED_STATUS[n.status].label}</StatusBadge></td>
                  <td className="px-2 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${formatPhone(n.number)}`} />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem render={<Link href={`/app/numbers/${n.id}`} />}><FileText />View details</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRename(n)}><Pencil />Rename</DropdownMenuItem>
                        <DropdownMenuItem disabled={n.status !== 'active'} onClick={() => setAssign(n)}><Workflow />Manage assignments</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" disabled={n.status === 'releasing'} onClick={() => setRelease(n)}><Trash2 />Release number</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RenameDialog number={rename} open={!!rename} onOpenChange={(o) => !o && setRename(null)} />
      <AssignmentSheet number={assign} open={!!assign} onOpenChange={(o) => !o && setAssign(null)} />
      <ReleaseDialog number={release} open={!!release} onOpenChange={(o) => !o && setRelease(null)} />
    </Panel>
  )
}

function ConnectionsTable({ connections }: { connections: ExternalConnection[] }) {
  const [disc, setDisc] = useState<ExternalConnection | null>(null)
  return (
    <Panel bodyClassName="p-0">
      {connections.length === 0 ? (
        <EmptyState icon={Link2} title="No connected lines" description="Keep your existing carrier and forward calls to Transovo." action={<Button render={<Link href="/app/numbers/connect" />}>Connect a number</Button>} />
      ) : (
        <ul className="divide-y">
          {connections.map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-5 py-4">
              <IconTile icon={PhoneForwarded} tone={c.status === 'verified' ? 'success' : c.status === 'needs_attention' ? 'warning' : 'default'} />
              <Link href={`/app/numbers/connections/${c.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums hover:text-primary">{formatPhone(c.number)}</span>
                  <span className="text-xs text-muted-foreground">{c.label} · {c.carrier}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <ProductChips products={c.products} />
                  <span>{c.forwardingTypes.map((f) => FORWARDING_LABEL[f]).join(', ')}</span>
                  <span>→ {formatPhone(c.forwardsTo)}</span>
                </span>
              </Link>
              <div className="hidden flex-col items-end gap-1 sm:flex">
                <StatusBadge tone={CONNECTION_STATUS[c.status].tone}>{CONNECTION_STATUS[c.status].label}</StatusBadge>
                <span className="text-[11px] text-muted-foreground">{c.lastTest ? `Tested ${formatWhen(c.lastTest)}` : 'Never tested'}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.label}`} />}>
                  <MoreHorizontal />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem render={<Link href={`/app/numbers/connections/${c.id}`} />}><FileText />View & test</DropdownMenuItem>
                  <DropdownMenuItem render={<Link href={`/app/numbers/port?number=${c.number}`} />}><ArrowRightLeft />Port this number</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setDisc(c)}><Unplug />Disconnect</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}
      <DisconnectDialog connection={disc} open={!!disc} onOpenChange={(o) => !o && setDisc(null)} />
    </Panel>
  )
}

export function NumbersActions() {
  return (
    <>
      <Button variant="outline" render={<Link href="/app/numbers/port" />}>
        <ArrowRightLeft data-icon="inline-start" />
        Port
      </Button>
      <Button variant="outline" render={<Link href="/app/numbers/connect" />}>
        <Link2 data-icon="inline-start" />
        Connect existing
      </Button>
      <Button render={<Link href="/app/numbers/new" />}>
        <Plus data-icon="inline-start" />
        Get a number
      </Button>
    </>
  )
}
