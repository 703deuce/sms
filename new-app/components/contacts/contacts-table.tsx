'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Download, MoreHorizontal, Phone, Plus, Upload, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Panel } from '@/components/app/page-primitives'
import { SearchInput, SegmentedFilter, SimpleSelect } from '@/components/app/filters'
import { StatusBadge, type Tone } from '@/components/app/status'
import { CONTACTS, TEAM, type Contact } from '@/lib/data'
import { formatPhone, formatWhen } from '@/lib/format'

const STATUS: Record<Contact['status'], { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'info' },
  lead: { label: 'Lead', tone: 'neutral' },
  customer: { label: 'Customer', tone: 'success' },
  blocked: { label: 'Blocked', tone: 'danger' },
}

type StatusFilter = 'all' | Contact['status']

export function ContactsTable() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [owner, setOwner] = useState('all')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CONTACTS.filter((c) => (status === 'all' || c.status === status) && (owner === 'all' || c.owner === owner)).filter(
      (c) => !q || [c.name, c.phone, c.email, c.company, ...c.tags].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [query, status, owner])

  return (
    <Panel
      bodyClassName="p-0"
      title={
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SegmentedFilter
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'customer', label: 'Customers' },
              { value: 'lead', label: 'Leads' },
              { value: 'active', label: 'Active' },
              { value: 'blocked', label: 'Blocked' },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SearchInput value={query} onChange={setQuery} placeholder="Name, phone, tag…" />
            <SimpleSelect
              label="Owner"
              value={owner}
              onChange={setOwner}
              options={[{ value: 'all', label: 'All owners' }, ...TEAM.map((t) => ({ value: t.name, label: t.name }))]}
            />
          </div>
        </div>
      }
    >
      {rows.length === 0 ? (
        <div className="p-6">
          <EmptyState icon={Users} title="No contacts match" description="Try a different search or clear filters." />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Name</TableHead>
              <TableHead>Primary phone</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Last interaction</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Tags</TableHead>
              <TableHead className="hidden lg:table-cell">Owner</TableHead>
              <TableHead className="pr-5 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="pl-5">
                  <Link href={`/app/contacts/${c.id}`} className="flex flex-col hover:underline">
                    <span className="font-medium">{c.name}</span>
                    {c.company && <span className="text-xs text-muted-foreground">{c.company}</span>}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatPhone(c.phone)}</TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{c.email ?? '—'}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{formatWhen(c.lastInteraction)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</StatusBadge>
                    {c.consent === 'opted_out' && <StatusBadge tone="warning">SMS opt-out</StatusBadge>}
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <StatusBadge key={t} tone="muted">
                        {t}
                      </StatusBadge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground lg:table-cell">{c.owner}</TableCell>
                <TableCell className="pr-5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Call ${c.name}`}
                      disabled={c.status === 'blocked'}
                      onClick={() => router.push(`/app/phone/dialer?to=${encodeURIComponent(c.phone)}`)}
                    >
                      <Phone />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More actions for ${c.name}`} />}>
                        <MoreHorizontal />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/app/contacts/${c.id}`)}>View profile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast('Edit contact', { description: 'Editing opens in the profile drawer.' })}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.success(`${c.name} archived`)}>Archive</DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => toast.success(`${c.name} blocked`, { description: 'Calls and texts from this number will be rejected.' })}>
                          <Ban />
                          Block
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  )
}

export function ContactsActions() {
  return (
    <>
      <Button variant="outline" onClick={() => toast('Import contacts', { description: 'Upload a CSV with name and phone columns. Duplicates with dialer leads are merged by phone.' })}>
        <Upload />
        Import
      </Button>
      <Button variant="outline" onClick={() => toast.success('Export started', { description: `${CONTACTS.length} contacts · CSV` })}>
        <Download />
        Export
      </Button>
      <Button onClick={() => toast('New contact', { description: 'Contact form coming from backend schema.' })}>
        <Plus />
        New contact
      </Button>
    </>
  )
}
