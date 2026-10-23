'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal, Phone, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState, Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { SearchInput } from '@/components/app/filters'
import { StatusBadge, type Tone } from '@/components/app/status'
import { deleteContactApi, fetchContactsPage } from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'
import { ContactsActions } from '@/components/contacts/contacts-table'

type Row = {
  id: string
  name: string
  phone: string
  email: string | null
  company: string | null
  status: string
  createdAt: string
}

function statusTone(status: string): { label: string; tone: Tone } {
  if (status === 'archived' || status === 'invalid') return { label: 'Inactive', tone: 'muted' }
  if (status === 'blocked' || status === 'unsubscribed') return { label: 'Blocked', tone: 'danger' }
  return { label: 'Active', tone: 'info' }
}

export function ContactsWorkspace() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [viewId, setViewId] = useState('')
  const [views, setViews] = useState<{ id: string; name: string; pinned: boolean }[]>([])

  const reload = useCallback(() => {
    setLoading(true)
    const nativeUrl = `/api/crm/native/contacts?q=${encodeURIComponent(query)}&page=1&pageSize=100${viewId ? `&viewId=${viewId}` : ''}`
    void fetch(nativeUrl)
      .then((r) => r.json())
      .then((j) => {
        if (j.data?.contacts) {
          setRows(
            j.data.contacts.map((c: { id: string; name: string; phone: string; email: string | null; company: string | null; status: string; createdAt: string }) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              company: c.company,
              status: c.status,
              createdAt: c.createdAt,
            })),
          )
          setTotal(j.data.total)
          return
        }
        return fetchContactsPage({ q: query, page: 1, pageSize: 100 }).then((data) => {
          setRows(data.contacts)
          setTotal(data.total)
        })
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not load contacts'))
      .finally(() => setLoading(false))
  }, [query, viewId])

  useEffect(() => {
    void fetch('/api/crm/native/views')
      .then((r) => r.json())
      .then((j) => setViews(j.data || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    const t = window.setTimeout(reload, query ? 250 : 0)
    return () => window.clearTimeout(t)
  }, [reload, query])

  const subtitle = useMemo(
    () =>
      total === 0
        ? 'Contacts in this workspace — one record per phone number.'
        : `${total} people in this workspace — power-dialer imports and manually added contacts.`,
    [total],
  )

  const onDelete = async (c: Row) => {
    if (!confirm(`Remove ${c.name} (${formatPhone(c.phone)})? Contacts with call history are marked inactive instead of deleted.`)) {
      return
    }
    try {
      const r = await deleteContactApi(c.id)
      if (r.action === 'archived') {
        toast.success(r.reason || 'Contact marked inactive')
      } else {
        toast.success('Contact deleted')
      }
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <Page>
      <PageHeader
        title="Contacts"
        description={subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ContactsActions total={total} />
            <a
              href="/api/crm/native/contacts/export"
              className="text-sm font-medium text-primary hover:underline"
            >
              Export
            </a>
          </div>
        }
      />
      <Panel
        bodyClassName="p-0"
        title={
          <div className="flex flex-wrap items-center gap-3">
            <SearchInput value={query} onChange={setQuery} placeholder="Name, phone, company…" />
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              aria-label="Saved view"
              value={viewId}
              onChange={(e) => setViewId(e.target.value)}
            >
              <option value="">All contacts</option>
              {views.map((v) => (
                <option key={v.id} value={v.id}>{v.pinned ? `★ ${v.name}` : v.name}</option>
              ))}
            </select>
          </div>
        }
      >
        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading contacts…</p>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title={query ? 'No contacts match' : 'No contacts yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'No contacts yet — import a calling list or add contacts from a list detail page.'
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const st = statusTone(c.status)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5">
                      <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatPhone(c.phone)}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{c.company || '—'}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatWhen(c.createdAt)}</TableCell>
                    <TableCell><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                    <TableCell className="pr-5 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Call ${c.name}`}
                          onClick={() => router.push(`/app/phone/dialer?to=${encodeURIComponent(c.phone)}`)}
                        >
                          <Phone />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`More for ${c.name}`} />}>
                            <MoreHorizontal />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/app/contacts/${c.id}`)}>View</DropdownMenuItem>
                            <DropdownMenuItem variant="destructive" onClick={() => void onDelete(c)}>Delete contact</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  )
}
