'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, PhoneCall } from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarCollapseButton,
} from '@/newui-transplant/components/ui/sidebar'
import {
  isVoiceProductCustomerVisible,
  mctbLaunchCustomerHome,
} from '@/lib/products/launch-product-availability'
import {
  resolveProductShellFromPath,
  readStoredProductShell,
  type ProductShell,
} from '@/lib/products/product-shell'
import { isSchedulingOpusChromePath } from '@/lib/products/newui-shell'
import { OpusProductSwitcher } from '@/newui-transplant/components/app/opus-product-switcher'
import { resolveCustomerNavSections, type NavItem, type NavSubItem } from '@/newui-transplant/lib/nav'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { findBestNavMatch, hrefPath, scoreNavHref } from '@/lib/nav-active'
import {
  isReceptionistWizardEditPath,
  stepIdFromReceptionistQuery,
} from '@/lib/voice/receptionist/wizard-step-url'
import { cn } from '@/lib/utils'

function searchStringFromParams(searchParams: URLSearchParams): string {
  const q = searchParams.toString()
  return q ? `?${q}` : ''
}

function navItemExpandKey(item: NavItem): string {
  return `${item.href}::${item.label}`
}

function isTopNavActive(pathname: string, search: string, item: NavItem) {
  if (item.children?.length) {
    const prefixPath = item.matchPrefix ? hrefPath(item.matchPrefix) : hrefPath(item.href)
    if (pathname === hrefPath(item.href) || pathname.startsWith(`${prefixPath}/`)) {
      if (isReceptionistWizardEditPath(pathname)) return false
      return true
    }
    const childHit = item.children.some((c) => scoreNavHref(pathname, search, c.href) >= 0)
    if (childHit) return true
    return false
  }
  if (scoreNavHref(pathname, search, item.href, item.matchExact ? true : undefined) >= 0) {
    return true
  }
  return false
}

function bestMatchingChild(
  pathname: string,
  search: string,
  children: NavSubItem[],
): NavSubItem | null {
  let best: NavSubItem | null = null
  let bestScore = -1
  for (const child of children) {
    const score = scoreNavHref(pathname, search, child.href)
    if (score > bestScore) {
      bestScore = score
      best = child
    }
  }
  return bestScore >= 0 ? best : null
}

function navItemsForMatch(sections: { items: NavItem[] }[]): NavItem[] {
  return sections.flatMap((section) => section.items)
}

/** Single parent group to expand for the current route (accordion — one open at a time). */
function expandedNavKeyForRoute(
  sections: { items: NavItem[] }[],
  pathname: string,
  search: string,
): string | null {
  const items = navItemsForMatch(sections)
  const best = findBestNavMatch(
    items.map((item) => ({
      href: item.href,
      matchExact: item.matchExact,
      children: item.children,
    })),
    pathname,
    search,
  )
  if (!best) return null

  if (best.isChild) {
    const parent = items.find((item) => item.children?.some((child) => child.href === best.href))
    return parent ? navItemExpandKey(parent) : null
  }

  const parent = items.find((item) => item.href === best.href)
  if (parent?.children?.length) return navItemExpandKey(parent)
  return null
}

function isSubNavActive(pathname: string, searchParams: URLSearchParams, child: NavSubItem) {
  if (!isReceptionistWizardEditPath(pathname)) return false
  const stepParam = searchParams.get('step')
  const childUrl = new URL(child.href, 'http://local')
  const childStep = childUrl.searchParams.get('step')
  if (childStep && stepParam) {
    return childStep === stepParam.trim().toLowerCase()
  }
  if (!stepParam && childStep === 'goals') return true
  const activeId = stepIdFromReceptionistQuery(stepParam)
  const childId = stepIdFromReceptionistQuery(childStep)
  return activeId !== null && childId !== null && activeId === childId
}

export type AppSidebarProps = {
  userName?: string
  hasMctb?: boolean
  hasAppointmentReminders?: boolean
  hasAiAfterHours?: boolean
  inboxBadge?: number
}

export function AppSidebar({
  userName,
  hasMctb = true,
  hasAppointmentReminders = true,
  hasAiAfterHours = false,
  inboxBadge = 0,
}: AppSidebarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const pathShell = resolveProductShellFromPath(pathname)
  const [storedShell, setStoredShell] = useState<ProductShell | null>(null)
  const search = searchStringFromParams(searchParams)
  const routeSyncKey = `${pathname}|${search}`
  const prevRouteSyncKey = useRef('')

  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  useEffect(() => {
    setStoredShell(readStoredProductShell())
  }, [pathname])

  const productShell: ProductShell = useMemo(() => {
    if (pathShell) return pathShell
    if (isSchedulingOpusChromePath(pathname)) return 'appointment_reminders'
    return storedShell ?? (hasMctb ? 'mctb' : 'appointment_reminders')
  }, [pathShell, pathname, storedShell, hasMctb])

  const navSections = useMemo(
    () => resolveCustomerNavSections(productShell, inboxBadge),
    [productShell, inboxBadge],
  )

  useEffect(() => {
    if (prevRouteSyncKey.current === routeSyncKey) return
    prevRouteSyncKey.current = routeSyncKey
    setExpandedKey(expandedNavKeyForRoute(navSections, pathname, search))
  }, [routeSyncKey, navSections, pathname, search])

  const brandHref =
    productShell === 'appointment_reminders' || productShell === 'appointments'
      ? AR_ROUTES.home
      : mctbLaunchCustomerHome()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-1 px-2 pb-1 pt-2.5">
        <div className="flex items-center gap-1 group-data-[collapsible=icon]:justify-center">
          <Link
            href={brandHref}
            className="flex min-w-0 flex-1 items-center gap-2 px-0.5 group-data-[collapsible=icon]:flex-none"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <PhoneCall className="size-4" aria-hidden="true" />
            </span>
            <span className="truncate text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
              Transovo
            </span>
          </Link>
          <SidebarCollapseButton className="group-data-[collapsible=icon]:hidden" />
        </div>
        <div className="hidden justify-center px-1 pt-1 group-data-[collapsible=icon]:flex">
          <SidebarCollapseButton />
        </div>
        <OpusProductSwitcher
          hasMctb={hasMctb}
          hasAppointmentReminders={hasAppointmentReminders}
          hasAiAfterHours={hasAiAfterHours}
        />
      </SidebarHeader>

      <SidebarContent className="pb-2 pt-0">
        {navSections.map((section) => (
          <SidebarGroup key={section.label} className="px-1.5 py-0.5">
            <SidebarGroupLabel className="px-1.5 pb-0.5 pt-1 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const hasChildren = Boolean(item.children?.length)
                  const expandKey = navItemExpandKey(item)
                  const parentActive = isTopNavActive(pathname, search, item)
                  const activeChild = hasChildren
                    ? bestMatchingChild(pathname, search, item.children!)
                    : null
                  const parentHighlighted = parentActive || Boolean(activeChild)
                  const isOpen = hasChildren && expandedKey === expandKey

                  return (
                    <SidebarMenuItem key={item.href}>
                      <div className="flex w-full min-w-0 items-center gap-0.5 group-data-[collapsible=icon]:justify-center">
                        <SidebarMenuButton
                          isActive={parentHighlighted}
                          tooltip={item.label}
                          render={<Link href={item.href} />}
                          className={cn(
                            'h-8 min-w-0 flex-1 data-active:bg-sidebar-accent data-active:text-sidebar-accent-foreground data-active:[&_svg]:text-sidebar-primary',
                            hasChildren && 'group-data-[collapsible=icon]:flex-none',
                          )}
                        >
                          <item.icon aria-hidden="true" />
                          <span className="truncate">{item.label}</span>
                        </SidebarMenuButton>
                        {item.badge ? (
                          <SidebarMenuBadge className="rounded-full bg-sidebar-primary/15 text-[10px] text-sidebar-primary group-data-[collapsible=icon]:hidden">
                            {item.badge}
                          </SidebarMenuBadge>
                        ) : null}
                        {hasChildren ? (
                          <button
                            type="button"
                            className="flex size-7 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:hidden"
                            aria-expanded={isOpen}
                            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${item.label}`}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setExpandedKey((current) =>
                                current === expandKey ? null : expandKey,
                              )
                            }}
                          >
                            <ChevronDown
                              className={cn('size-4 transition-transform', isOpen && 'rotate-180')}
                              aria-hidden="true"
                            />
                          </button>
                        ) : null}
                      </div>
                      {hasChildren && isOpen ? (
                        <SidebarMenuSub>
                          {item.children!.map((child) => {
                            const childActive = isReceptionistWizardEditPath(pathname)
                              ? isSubNavActive(pathname, searchParams, child)
                              : activeChild?.href === child.href
                            return (
                              <SidebarMenuSubItem key={child.href}>
                                <SidebarMenuSubButton
                                  isActive={childActive}
                                  size="sm"
                                  render={<Link href={child.href} />}
                                >
                                  <span>{child.label}</span>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          })}
                        </SidebarMenuSub>
                      ) : null}
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {isVoiceProductCustomerVisible() ? (
        <SidebarFooter className="px-3 pb-4 group-data-[collapsible=icon]:hidden">
          <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-sidebar-accent-foreground">AI minutes</span>
              <span className="text-sidebar-foreground/70">1,284 / 2,000</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border">
              <div className="h-full w-[64%] rounded-full bg-sidebar-primary" />
            </div>
            <Link href="/settings/billing" className="mt-2 inline-block text-[11px] text-sidebar-primary hover:underline">
              Manage plan
            </Link>
          </div>
        </SidebarFooter>
      ) : null}
      <SidebarRail />
    </Sidebar>
  )
}
