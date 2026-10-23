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
import { cn } from '@/lib/utils'
import { ContactsActions } from '@/components/contacts/contacts-table'
import { ContactsFolderTree } from '@/components/contacts/contacts-folder-tree'
import { ContactMergeWizard } from '@/components/contacts/contact-merge-wizard'
import { ContactsSavedViewsSheet } from '@/components/contacts/contacts-saved-views-sheet'

type Row = {
  id: string
  name: string
  phone: string
  email: string | null
  company: string | null
  status: string
  createdAt: string
  ownerUserId: string | null
  lastActivityAt: string | null
  nextFollowUpAt: string | null
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
  const [folderId, setFolderId] = useState('')
  const [views, setViews] = useState<{ id: string; name: string; pinned: boolean }[]>([])
  const [mergeOpen, setMergeOpen] = useState(false)
  const [viewsSheetOpen, setViewsSheetOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [newPhone, setNewPhone] = useState('')
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    const nativeUrl = `/api/crm/native/contacts?q=${encodeURIComponent(query)}&page=1&pageSize=100${viewId ? `&viewId=${viewId}` : ''}${folderId ? `&folderId=${folderId}` : ''}`
    void fetch(nativeUrl)
      .then(async (r) => {
        const j = await r.json()
        if (!r.ok || j.error) {
          throw new Error(typeof j.error === 'string' ? j.error : `Could not load contacts (${r.status})`)
        }
        if (j.data?.contacts) {
          setRows(
            j.data.contacts.map((c: Row) => ({
              id: c.id,
              name: c.name,
              phone: c.phone,
              email: c.email,
              company: c.company,
              status: c.status,
              createdAt: c.createdAt,
              ownerUserId: c.ownerUserId ?? null,
              lastActivityAt: c.lastActivityAt ?? null,
              nextFollowUpAt: c.nextFollowUpAt ?? null,
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
      .catch((e) => {
        const msg = e instanceof Error ? e.message : 'Could not load contacts'
        setLoadError(msg)
        setRows([])
        setTotal(0)
        toast.error(msg)
      })
      .finally(() => setLoading(false))
  }, [query, viewId, folderId])

  const reloadViews = useCallback(() => {
    void fetch('/api/crm/native/views')
      .then((r) => r.json())
      .then((j) => setViews(j.data || []))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    reloadViews()
  }, [reloadViews])

  useEffect(() => {
    if (viewId || folderId) return
    const defaultView = views.find((v) => v.pinned)
    if (defaultView) setViewId(defaultView.id)
  }, [views, viewId, folderId])

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
            <ContactsActions total={total} onMerge={() => setMergeOpen(true)} onNewContact={() => setNewContactOpen(true)} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm">More</Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setMergeOpen(true)}>Merge duplicates</DropdownMenuItem>
                <DropdownMenuItem render={<a href="/app/power-dialer/calling-lists" />}>Import via calling lists</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedIds.size > 0 && folderId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void fetch('/api/crm/native/contacts/bulk', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contactIds: [...selectedIds], patch: { folderId } }),
                  })
                    .then((r) => r.json())
                    .then(() => {
                      toast.success(`Moved ${selectedIds.size} contact(s)`)
                      setSelectedIds(new Set())
                      reload()
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Move failed'))
                }}
              >
                Move {selectedIds.size} to folder
              </Button>
            )}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download endpoint */}
            <a
              href="/api/crm/native/contacts/export"
              className="text-sm font-medium text-primary hover:underline"
            >
              Export
            </a>
          </div>
        }
      />
      {loadError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {loadError}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[200px_1fr]">
        <Panel title="All contacts" className="h-fit">
          <div className="mb-3 flex flex-col gap-1 text-sm">
            <button
              type="button"
              className={cn(
                'rounded-md px-2 py-1.5 text-left',
                !folderId && !viewId ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted',
              )}
              onClick={() => {
                setFolderId('')
                setViewId('')
              }}
            >
              All contacts
            </button>
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</p>
          <ContactsFolderTree selectedFolderId={folderId} onSelectFolder={setFolderId} onFoldersChange={reload} />
          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Saved views</p>
          <div className="flex flex-col gap-1">
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-sm',
                  viewId === v.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted',
                )}
                onClick={() => {
                  setViewId(v.id)
                  setFolderId('')
                }}
              >
                {v.pinned ? '★ ' : ''}{v.name}
              </button>
            ))}
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setViewsSheetOpen(true)}>
              Manage views
            </Button>
          </div>
        </Panel>
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
        ) : loadError ? (
          <p className="p-6 text-sm text-muted-foreground">Fix the error above and try again.</p>
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
                <TableHead className="pl-5 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={rows.length > 0 && rows.every((r) => selectedIds.has(r.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(rows.map((r) => r.id)))
                      else setSelectedIds(new Set())
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Primary phone</TableHead>
                <TableHead className="hidden lg:table-cell">Company</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden xl:table-cell">Last activity</TableHead>
                <TableHead className="hidden xl:table-cell">Next follow-up</TableHead>
                <TableHead className="pr-5 text-right"><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const st = statusTone(c.status)
                return (
                  <TableRow key={c.id}>
                    <TableCell className="pl-5">
                      <input
                        type="checkbox"
                        aria-label={`Select ${c.name}`}
                        checked={selectedIds.has(c.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(c.id)
                            else next.delete(c.id)
                            return next
                          })
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/app/contacts/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatPhone(c.phone)}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{c.company || '—'}</TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">{c.email || '—'}</TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">{c.ownerUserId?.slice(0, 8) || '—'}</TableCell>
                    <TableCell><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">{c.lastActivityAt ? formatWhen(c.lastActivityAt) : '—'}</TableCell>
                    <TableCell className="hidden text-muted-foreground xl:table-cell">{c.nextFollowUpAt ? formatWhen(c.nextFollowUpAt) : '—'}</TableCell>
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
      </div>
      <ContactMergeWizard open={mergeOpen} onOpenChange={setMergeOpen} onMerged={reload} />
      <ContactsSavedViewsSheet
        open={viewsSheetOpen}
        onOpenChange={setViewsSheetOpen}
        views={views}
        onViewsChange={reloadViews}
        activeViewId={viewId}
        onSelectView={setViewId}
      />
      {newContactOpen && (
        <Panel title="Add contact" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md border shadow-lg md:relative md:inset-auto md:shadow-none">
          <div className="grid gap-2">
            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (E.164)" aria-label="Phone" />
            <Input value={newFirst} onChange={(e) => setNewFirst(e.target.value)} placeholder="First name" aria-label="First name" />
            <Input value={newLast} onChange={(e) => setNewLast(e.target.value)} placeholder="Last name" aria-label="Last name" />
            <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" aria-label="Email" />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  void fetch('/api/crm/native/contacts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: newPhone, firstName: newFirst, lastName: newLast, email: newEmail }),
                  })
                    .then(async (r) => {
                      const j = await r.json()
                      if (!r.ok || j.error) throw new Error(j.error || 'Create failed')
                      toast.success('Contact created')
                      setNewContactOpen(false)
                      setNewPhone('')
                      setNewFirst('')
                      setNewLast('')
                      setNewEmail('')
                      reload()
                    })
                    .catch((e) => toast.error(e instanceof Error ? e.message : 'Create failed'))
                }}
              >
                Save contact
              </Button>
              <Button type="button" variant="ghost" onClick={() => setNewContactOpen(false)}>Cancel</Button>
            </div>
          </div>
        </Panel>
      )}
    </Page>
  )
}
