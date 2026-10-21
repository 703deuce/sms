'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ChevronDown, CircleDot, FlaskConical, Loader2, Rocket, Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { IconTile } from '@/components/app/page-primitives'
import { StatusBadge, type Tone } from '@/components/app/status'
import { useAgent, type AgentStatus } from '@/components/providers/agent-provider'
import { formatWhen } from '@/lib/format'
import { cn } from '@/lib/utils'

export const AGENT_STATUS: Record<AgentStatus, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warning' },
  draft: { label: 'Draft', tone: 'neutral' },
  publishing: { label: 'Publishing', tone: 'info' },
  sync_failed: { label: 'Sync failed', tone: 'danger' },
}

export function AgentStatusBadge({ className }: { className?: string }) {
  const { status } = useAgent()
  const s = AGENT_STATUS[status]
  return (
    <StatusBadge tone={s.tone} className={className}>
      {status === 'publishing' && <Loader2 className="size-3 animate-spin" aria-hidden />}
      {s.label}
    </StatusBadge>
  )
}

/** Sticky draft/publish bar shown on every AI editor page. Never publishes implicitly. */
export function DraftBar({ testHref = '/app/receptionist/test' }: { testHref?: string }) {
  const { unsaved, changes, lastSaved, lastPublished, saveDraft, discardDraft, status } = useAgent()
  const [saving, setSaving] = useState(false)
  const hasChanges = changes.length > 0

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-1 border-b bg-background/85 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Live</span>
            <AgentStatusBadge />
          </span>
          <span aria-hidden className="hidden h-3 w-px bg-border sm:block" />
          <span>Saved {formatWhen(lastSaved)}</span>
          <span>Published {formatWhen(lastPublished)}</span>
          {unsaved ? (
            <span className="flex items-center gap-1 font-medium text-warning-foreground">
              <CircleDot className="size-3" aria-hidden />
              Unsaved edits
            </span>
          ) : hasChanges ? (
            <span className="flex items-center gap-1 font-medium text-primary">
              <CircleDot className="size-3" aria-hidden />
              {changes.length} draft {changes.length === 1 ? 'change' : 'changes'} not live
            </span>
          ) : (
            <span>Draft matches live</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void discardDraft().then(() => toast('Draft restored to live version'))
              }}
            >
              <Undo2 data-icon="inline-start" />
              Discard
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!unsaved || saving}
            onClick={async () => {
              setSaving(true)
              try {
                await saveDraft()
                toast.success('Draft saved — live calls are unchanged')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Could not save draft')
              } finally {
                setSaving(false)
              }
            }}
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <Save data-icon="inline-start" />}
            Save draft
          </Button>
          <Button variant="outline" size="sm" render={<Link href={testHref} />}>
            <FlaskConical data-icon="inline-start" />
            Test
          </Button>
          <Button
            size="sm"
            disabled={status === 'publishing'}
            render={
              <Link
                href="/app/receptionist/activate"
                aria-label={
                  hasChanges || unsaved
                    ? 'Review and publish draft changes'
                    : 'Open review and publish (no draft changes yet)'
                }
              />
            }
          >
            <Rocket data-icon="inline-start" />
            Publish
          </Button>
        </div>
      </div>
    </div>
  )
}

export function Section({
  id,
  icon,
  title,
  description,
  badge,
  defaultOpen = true,
  children,
}: {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-xl surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-body`}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <IconTile icon={icon} tone={open ? 'primary' : 'default'} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            {title}
            {badge}
          </span>
          {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={`${id}-body`} className="flex flex-col gap-5 border-t px-5 py-5">
          {children}
        </div>
      )}
    </section>
  )
}

export function JumpChips({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav aria-label="Jump to section" className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <a key={i.id} href={`#${i.id}`} className="rounded-full surface px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          {i.label}
        </a>
      ))}
    </nav>
  )
}

export function ToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled,
  badge,
  action,
}: {
  title: string
  description?: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  badge?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 py-3', disabled && 'opacity-60')}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {title}
          {badge}
        </span>
        {description && <span className="text-xs leading-relaxed text-muted-foreground">{description}</span>}
        {action && <span className="pt-1">{action}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={(v) => onChange(!!v)} disabled={disabled} aria-label={title} />
    </div>
  )
}

export function NotAvailable({ label = 'Not available yet' }: { label?: string }) {
  return <StatusBadge tone="muted">{label}</StatusBadge>
}

export function Pills<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string; disabled?: boolean }[]
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div role="radiogroup" aria-label={label} className="inline-flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium text-muted-foreground transition-all disabled:cursor-not-allowed disabled:opacity-40',
              value === o.value && 'bg-card text-foreground shadow-sm ring-1 ring-foreground/5',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DemoNote() {
  return <p className="text-[11px] text-muted-foreground">Design preview — sample data, wired to the Voice V3 backend later.</p>
}
