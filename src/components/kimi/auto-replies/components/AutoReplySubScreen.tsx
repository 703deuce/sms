"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { V1Breadcrumb, V1PageHeader, V1WizardFooter } from "@/components/v1/v1-polish";

type BreadcrumbItem = { label: string; href?: string; onClick?: () => void };

export function AutoReplySubScreen({
  emoji,
  title,
  description,
  breadcrumb,
  onBack,
  onSave,
  saveLabel = "Save",
  saving,
  headerActions,
  children,
  hideFooter,
}: {
  emoji: string;
  title: string;
  description?: string;
  breadcrumb: BreadcrumbItem[];
  onBack: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  hideFooter?: boolean;
}) {
  return (
    <div>
      <V1Breadcrumb items={[{ label: "Auto-Replies", href: "/auto-replies" }, ...breadcrumb]} />
      <V1PageHeader emoji={emoji} title={title} description={description} actions={headerActions} />
      {children}
      {!hideFooter && onSave ? (
        <V1WizardFooter onBack={onBack} onNext={onSave} nextLabel={saveLabel} nextLoading={saving} />
      ) : !hideFooter ? (
        <V1WizardFooter onBack={onBack} />
      ) : null}
    </div>
  );
}

export function AutoReplyToggleRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="surface flex items-start justify-between gap-8 rounded-xl bg-card p-4 transition-colors duration-150 hover:border-primary/25">
      <div className="min-w-0">
        <h3 className="text-[14.5px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

export function AutoReplyAccordion({
  open,
  onToggle,
  icon,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all duration-150",
        open
          ? "border-primary/30 shadow-sm ring-1 ring-primary/10"
          : "border-border hover:border-primary/20 hover:shadow-sm",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
        onClick={onToggle}
      >
        <span className="flex items-center gap-3 text-[14px] font-semibold text-foreground">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
              open ? "bg-primary/10" : "bg-muted",
            )}
          >
            {icon}
          </span>
          {title}
        </span>
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors",
            open ? "text-primary" : "text-muted-foreground/60",
          )}
        >
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border/70 px-5 pb-5 pt-4">{children}</div>
      ) : null}
    </div>
  );
}
