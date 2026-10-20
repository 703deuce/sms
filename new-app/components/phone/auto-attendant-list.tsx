'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ListTree, Phone, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState, PageHeader, Panel } from '@/components/app/page-primitives'
import {
  createAutoAttendantMenu,
  duplicateAutoAttendantMenu,
  fetchAutoAttendantMenus,
  type AutoAttendantMenuDto,
} from '@/lib/phone-forwarding-api'

export function AutoAttendantList() {
  const [menus, setMenus] = useState<AutoAttendantMenuDto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchAutoAttendantMenus()
      .then(setMenus)
      .catch(() => toast.error('Could not load phone menus'))
      .finally(() => setLoading(false))
  }, [])

  const createMenu = () => {
    void createAutoAttendantMenu('New phone menu')
      .then((row) => {
        window.location.href = `/app/phone/auto-attendant/${row.id}`
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Could not create menu'))
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Auto Attendant"
        description="Greet callers professionally and direct them with a simple phone menu."
        eyebrow={
          <span className="inline-flex items-center gap-2 text-muted-foreground">
            <ListTree className="size-4" aria-hidden />
            Phone
          </span>
        }
        actions={
          <Button type="button" size="sm" onClick={createMenu}>
            <Plus className="size-4" />
            Create phone menu
          </Button>
        }
      />

      <Panel>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : menus.length === 0 ? (
          <EmptyState
            icon={Phone}
            title="Give callers a professional welcome"
            description="Let callers press 1 for scheduling, 2 for service, or any options you choose."
            action={
              <Button type="button" onClick={createMenu}>
                Create phone menu
              </Button>
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu</TableHead>
                <TableHead>Options</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menus.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div className="font-medium">{m.name}</div>
                    {m.description && (
                      <div className="text-xs text-muted-foreground">{m.description}</div>
                    )}
                  </TableCell>
                  <TableCell>{m.options.length}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === 'published' ? 'default' : 'secondary'}>
                      {m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" asChild>
                      <Link href={`/app/phone/auto-attendant/${m.id}`}>Open</Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        void duplicateAutoAttendantMenu(m.id)
                          .then(() => fetchAutoAttendantMenus().then(setMenus))
                          .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed'))
                      }
                    >
                      Duplicate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
