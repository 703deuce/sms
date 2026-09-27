"use client";

import { EmptyState, Panel, Rows } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Play, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Thin re-exports — all visual language comes from newui-transplant Opus kit.
 * Step files import from here so the mapping doc stays accurate.
 */
export {
  Page,
  PageHeader,
  Panel,
  FieldRow,
  Rows,
  Pill,
  TextLink,
  EmptyState,
} from "@/newui-transplant/components/app/kit";

/** Legacy bordered card vs Opus `Panel` — same content, mapped visual language. */
export function WizardSection({
  opus,
  title,
  description,
  children,
  className,
}: {
  opus: boolean;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  if (opus) {
    return (
      <Panel title={title} description={description} className={className}>
        {children}
      </Panel>
    );
  }
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </div>
  );
}
export { Button } from "@/newui-transplant/components/ui/button";
export { ButtonLink } from "@/newui-transplant/components/app/button-link";
export { Input } from "@/newui-transplant/components/ui/input";
export { Label } from "@/newui-transplant/components/ui/label";
export { Textarea } from "@/newui-transplant/components/ui/textarea";
export { Switch } from "@/newui-transplant/components/ui/switch";
export { Checkbox } from "@/newui-transplant/components/ui/checkbox";
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/newui-transplant/components/ui/table";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "@/newui-transplant/components/ui/tabs";
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
export {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/newui-transplant/components/ui/dialog";

/** Highlighted inset block (replaces legacy `border-primary/30 bg-card` divs on Opus). */
export function OpusCalloutPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Panel title={title} className={cn("border-primary/30 shadow-none", className)} bodyClassName="p-4 text-sm">
      {children}
    </Panel>
  );
}

/** Standard nested block inside a step (replaces legacy `rounded-xl border bg-card` on Opus). */
export function OpusDensePanel({
  title,
  description,
  children,
  className,
  action,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Panel
      title={title}
      description={description}
      action={action}
      className={cn("shadow-none", className)}
      bodyClassName={cn("p-4", bodyClassName)}
    >
      {children}
    </Panel>
  );
}

/** Nested section inside a step (qualification, transfer destination, etc.). */
export function OpusSectionInset({
  isOpus,
  children,
  className,
}: {
  isOpus: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (isOpus) {
    return (
      <OpusDensePanel className={cn("mt-6 shadow-none", className)} bodyClassName="p-4">
        {children}
      </OpusDensePanel>
    );
  }
  return (
    <div className={cn("mt-6 rounded-xl border border-border bg-card p-4", className)}>
      {children}
    </div>
  );
}

/** Compact bordered block for nested rows (rules, destinations, schedule days). */
export function OpusCompactPanel({
  isOpus,
  children,
  className,
  bodyClassName,
}: {
  isOpus: boolean;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  if (isOpus) {
    return (
      <Panel
        className={cn("shadow-none", className)}
        bodyClassName={cn("space-y-2 p-3", bodyClassName)}
      >
        {children}
      </Panel>
    );
  }
  return (
    <div className={cn("space-y-2 rounded-lg border border-border p-3", className)}>
      {children}
    </div>
  );
}

/** Inline error / alert on Opus steps (replaces raw destructive bordered paragraphs). */
export function OpusInlineAlert({
  isOpus,
  children,
  className,
}: {
  isOpus: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (isOpus) {
    return (
      <Panel className={cn("border-destructive/30 shadow-none", className)} bodyClassName="p-3">
        <p className="text-sm text-destructive" role="alert">{children}</p>
      </Panel>
    );
  }
  return (
    <p
      className={cn(
        "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive",
        className,
      )}
      role="alert"
    >
      {children}
    </p>
  );
}

/** Clickable option card — kit `Panel` + transplant `Button` (no merged legacy card chrome). */
export function OpusChoiceCard({
  selected,
  onClick,
  title,
  description,
  icon,
  children,
  disabled,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <Panel
      className={cn(
        "shadow-none transition-colors",
        selected && "border-primary",
        disabled && "opacity-60",
        className,
      )}
      bodyClassName="p-0"
    >
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={onClick}
        className="relative h-auto w-full flex-col items-stretch gap-0 rounded-[inherit] px-4 py-4 text-left font-normal hover:bg-muted/30"
      >
        {selected ? (
          <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : null}
        <div className="flex items-start gap-3 pr-6">
          {icon ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {description ? (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
            {children}
          </div>
        </div>
      </Button>
    </Panel>
  );
}

/** Single radio-style row — kit `Panel` shell. */
export function OpusRadioRow({
  selected,
  onClick,
  label,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  description?: string;
}) {
  return (
    <Panel className={cn("shadow-none", selected && "border-primary")} bodyClassName="p-0">
      <Button
        type="button"
        variant="ghost"
        onClick={onClick}
        aria-pressed={selected}
        className="h-auto w-full justify-start gap-3 rounded-[inherit] px-4 py-3 text-left text-sm font-normal hover:bg-muted/30"
      >
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-primary" : "border-muted-foreground/40",
          )}
        >
          {selected ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {description ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
          ) : null}
        </span>
      </Button>
    </Panel>
  );
}

/** Voice picker row inside kit `Panel`. */
export function OpusVoicePickRow({
  selected,
  label,
  badge,
  previewing,
  onSelect,
  onPreview,
}: {
  selected: boolean;
  label: string;
  badge: string;
  previewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}) {
  return (
    <Panel
      className={cn("shadow-none", selected && "border-primary")}
      bodyClassName="flex items-center justify-between gap-2 p-2"
    >
      <Button
        type="button"
        variant="ghost"
        className="min-w-0 flex-1 justify-start px-2 text-left font-normal"
        onClick={onSelect}
      >
        <span className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{badge}</p>
        </span>
      </Button>
      <div className="flex shrink-0 items-center gap-1">
        {selected ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
        <Button type="button" size="sm" variant="outline" onClick={onPreview}>
          <Play className={previewing ? "animate-pulse" : ""} />
          Play
        </Button>
      </div>
    </Panel>
  );
}

/** Table region inside kit `Panel` (collect fields, appointment types). */
export function OpusTableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Panel className={cn("shadow-none overflow-hidden", className)} bodyClassName="overflow-x-auto p-0">
      {children}
    </Panel>
  );
}

/** Stacked list rows with dividers inside one `Panel`. */
export function OpusDividedList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Panel className={cn("shadow-none", className)} bodyClassName="divide-y p-0">
      {children}
    </Panel>
  );
}

/** Warning / validation list (transfer issues, etc.). */
export function OpusWarningPanel({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <OpusCalloutPanel title={title} className={cn("border-amber-500/40", className)}>
      <div className="text-xs text-amber-900 dark:text-amber-100">{children}</div>
    </OpusCalloutPanel>
  );
}

/** Side-preview stat block (voice summary, etc.). */
export function OpusSidePreview({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <OpusDensePanel bodyClassName="flex items-center gap-3 p-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </OpusDensePanel>
  );
}

export function OpusKeyValueRows({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <Rows
      items={items.map((item) => ({
        label: item.label,
        value: <span className="text-sm font-medium">{item.value}</span>,
      }))}
    />
  );
}

/** Compact summary tile with optional manage link (replaces raw bordered divs on Opus surfaces). */
export function OpusLinkTile({
  icon: Icon,
  title,
  description,
  href,
  linkLabel = "Manage",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  linkLabel?: string;
}) {
  return (
    <OpusDensePanel bodyClassName="px-4 py-3">
      <div className="flex items-start gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
          <TextLink href={href} className="mt-1 inline-block text-xs">
            {linkLabel}
          </TextLink>
        </div>
      </div>
    </OpusDensePanel>
  );
}

export function SelectedAppointmentConfigShell({
  isOpus,
  onClose,
  children,
}: {
  isOpus: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeBtn = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground"
      aria-label="Close"
      onClick={onClose}
    >
      <X className="h-4 w-4" />
    </Button>
  );
  if (isOpus) {
    return (
      <OpusDensePanel title="Appointment configuration" action={closeBtn}>
        {children}
      </OpusDensePanel>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Appointment configuration</h3>
        {closeBtn}
      </div>
      {children}
    </div>
  );
}
