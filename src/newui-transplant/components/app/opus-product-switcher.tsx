'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Check, ChevronDown, LayoutGrid, Moon, PhoneMissed } from 'lucide-react'
import {
  appointmentRemindersProductShellHome,
  mctbShellHome,
  aiAfterHoursShellHome,
  productShellLabel,
  PRODUCT_SWITCHER_ONBOARDING_KEY,
  readStoredProductShell,
  resolveProductShellFromPath,
  shellHomePath,
  shouldShowProductSwitcher,
  visibleProductShells,
  writeStoredProductShell,
  type ProductShell,
} from '@/lib/products/product-shell'
import { cn } from '@/lib/utils'
import { SidebarMenuButton } from '@/newui-transplant/components/ui/sidebar'

type Props = {
  hasMctb: boolean
  hasAppointmentReminders: boolean
  hasAiAfterHours: boolean
  className?: string
}

const SHELL_META: Record<
  ProductShell,
  { icon: typeof Bell; description: string } | undefined
> = {
  appointments: undefined,
  appointment_reminders: {
    icon: Bell,
    description: 'Calendar-synced SMS reminders for upcoming appointments',
  },
  mass_sms: undefined,
  mctb: {
    icon: PhoneMissed,
    description: 'Missed calls, voicemail, conversations, and text-back setup',
  },
  ai_after_hours: {
    icon: Moon,
    description: 'AI receptionist, calls, and after-hours call handling',
  },
}

function useOpusProductShell(hasMctb: boolean, hasAppointmentReminders: boolean, hasAiAfterHours: boolean) {
  const pathname = usePathname()
  const fromPath = useMemo(() => resolveProductShellFromPath(pathname), [pathname])
  const entitlement = { hasMctb, hasMassSms: false, hasAiAfterHours, hasAppointmentReminders }
  const [shell, setShellState] = useState<ProductShell>(() =>
    fromPath ?? readStoredProductShell() ?? (hasMctb ? 'mctb' : 'appointment_reminders'),
  )

  useEffect(() => {
    if (fromPath) {
      setShellState(fromPath)
      writeStoredProductShell(fromPath)
      return
    }
    const stored = readStoredProductShell()
    if (stored) setShellState(stored)
  }, [fromPath])

  const setShell = (next: ProductShell) => {
    writeStoredProductShell(next)
    setShellState(next)
  }

  return { shell: fromPath ?? shell, setShell, entitlement }
}

export function OpusProductSwitcher({ hasMctb, hasAppointmentReminders, hasAiAfterHours, className }: Props) {
  const router = useRouter()
  const { shell, setShell, entitlement } = useOpusProductShell(
    hasMctb,
    hasAppointmentReminders,
    hasAiAfterHours,
  )
  const visibleShells = visibleProductShells(entitlement)
  const showSwitcher = shouldShowProductSwitcher(entitlement)
  const [open, setOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSwitcher) return
    try {
      if (!window.localStorage.getItem(PRODUCT_SWITCHER_ONBOARDING_KEY)) {
        setShowOnboarding(true)
      }
    } catch {
      // ignore
    }
  }, [showSwitcher])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!showSwitcher) return null

  const activeMeta = SHELL_META[shell]
  const ActiveIcon = activeMeta?.icon ?? LayoutGrid

  function selectShell(next: ProductShell) {
    if (next === shell) {
      setOpen(false)
      return
    }
    setShell(next)
    setOpen(false)
    router.push(shellHomePath(next))
  }

  function dismissOnboarding() {
    setShowOnboarding(false)
    try {
      window.localStorage.setItem(PRODUCT_SWITCHER_ONBOARDING_KEY, '1')
    } catch {
      // ignore
    }
  }

  return (
    <div ref={rootRef} className={cn('relative px-1.5 pb-2 group-data-[collapsible=icon]:px-1', className)}>
      <SidebarMenuButton
        type="button"
        tooltip="Switch product"
        className="h-auto min-h-9 flex-col items-start gap-0.5 py-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex w-full items-center gap-2 group-data-[collapsible=icon]:w-auto">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary/15 text-sidebar-primary">
            <ActiveIcon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="block text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
              Product
            </span>
            <span className="flex items-center gap-1 truncate text-xs font-semibold text-sidebar-accent-foreground">
              {productShellLabel(shell)}
              <ChevronDown
                className={cn('size-3.5 shrink-0 text-sidebar-foreground/50 transition', open && 'rotate-180')}
                aria-hidden="true"
              />
            </span>
          </span>
        </span>
      </SidebarMenuButton>

      {open ? (
        <div
          role="listbox"
          aria-label="Switch product"
          className="absolute left-2 right-2 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border bg-popover p-1 shadow-md group-data-[collapsible=icon]:left-full group-data-[collapsible=icon]:right-auto group-data-[collapsible=icon]:top-0 group-data-[collapsible=icon]:ml-2 group-data-[collapsible=icon]:w-72"
        >
          {visibleShells.map((optionShell) => {
            const meta = SHELL_META[optionShell]
            if (!meta) return null
            const active = shell === optionShell
            return (
              <button
                key={optionShell}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => selectShell(optionShell)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                    active ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'bg-muted',
                  )}
                >
                  <meta.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-medium">
                    {productShellLabel(optionShell)}
                    {active ? <Check className="size-3.5 text-sidebar-primary" aria-hidden="true" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{meta.description}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {showOnboarding ? (
        <div className="absolute left-2 right-2 top-[calc(100%+8px)] z-50 rounded-lg border bg-popover p-3 text-sm shadow-md group-data-[collapsible=icon]:hidden">
          <p className="font-medium">Multiple products</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Switch between Appointment Reminders and Missed Call Text Back. Each product has its own menu.
          </p>
          <button
            type="button"
            onClick={dismissOnboarding}
            className="mt-2 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
          >
            Got it
          </button>
        </div>
      ) : null}
    </div>
  )
}

export { appointmentRemindersProductShellHome, mctbShellHome, aiAfterHoursShellHome }
