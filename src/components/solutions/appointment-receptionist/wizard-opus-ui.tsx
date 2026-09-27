"use client";

import { Panel } from "@/newui-transplant/components/app/kit";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Thin re-exports — all visual language comes from newui-transplant Opus kit.
 * Step files import from here so the mapping doc stays accurate.
 */
export { Page, PageHeader, Panel, FieldRow, Rows, Pill, TextLink } from "@/newui-transplant/components/app/kit";

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
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <Panel
      title={title}
      description={description}
      action={action}
      className={cn("shadow-none", className)}
      bodyClassName="p-4"
    >
      {children}
    </Panel>
  );
}
