'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Skeleton } from '@/components/ui/skeleton'
import { useBreadcrumbTitles } from '@/components/shell/breadcrumb-context'
import { Button } from '@/components/ui/button'

export function AppBreadcrumbs() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { titles } = useBreadcrumbTitles()

  const crumbs: { label: string; href?: string }[] = []

  if (pathname === '/app/clips') {
    crumbs.push({ label: 'Projects' })
  } else if (pathname === '/app/clips/new') {
    crumbs.push({ label: 'Projects', href: '/app/clips' }, { label: 'New project' })
  } else if (pathname.match(/^\/app\/clips\/[^/]+$/) && !pathname.includes('/edit/')) {
    crumbs.push({ label: 'Projects', href: '/app/clips' })
    crumbs.push({ label: titles.project || '…' })
  } else if (pathname.includes('/edit/')) {
    const projectId = pathname.split('/')[3]
    crumbs.push({ label: 'Projects', href: '/app/clips' })
    crumbs.push({
      label: titles.project || '…',
      href: projectId ? `/app/clips/${projectId}` : undefined,
    })
    crumbs.push({ label: titles.clip || '…' })
  } else if (pathname.startsWith('/app/clips/brand')) {
    crumbs.push({ label: 'Brand' })
    const tab = searchParams.get('tab')
    crumbs.push({ label: tab === 'templates' ? 'Templates' : 'Brand kit' })
  } else if (pathname.startsWith('/app/clips/exports')) {
    crumbs.push({ label: 'Exports' })
  } else if (pathname.startsWith('/app/settings')) {
    crumbs.push({ label: 'Settings' })
  } else if (pathname.startsWith('/app/integrations')) {
    crumbs.push({ label: 'Integrations' })
  } else if (pathname.startsWith('/app/help')) {
    crumbs.push({ label: 'Help' })
  }

  if (!crumbs.length) return null

  const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2] : null
  const last = crumbs[crumbs.length - 1]
  const pending = last.label === '…'

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {parent?.href && (
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0 md:hidden"
          render={<Link href={parent.href} aria-label="Back" />}
        >
          <ChevronLeft className="size-4" />
        </Button>
      )}
      <Breadcrumb className="min-w-0 max-md:[&_li:not(:last-child)]:hidden">
        <BreadcrumbList>
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? (
                <BreadcrumbSeparator>
                  <ChevronRight className="size-3.5" />
                </BreadcrumbSeparator>
              ) : null}
              <BreadcrumbItem>
                {c.href && i < crumbs.length - 1 ? (
                  <BreadcrumbLink render={<Link href={c.href} className="max-w-[22ch] truncate" />}>
                    {c.label}
                  </BreadcrumbLink>
                ) : pending && i === crumbs.length - 1 ? (
                  <Skeleton className="h-4 w-24" />
                ) : (
                  <BreadcrumbPage className="max-w-[22ch] truncate">{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
