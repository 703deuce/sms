"use client";

import { EmptyState, Panel } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
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
