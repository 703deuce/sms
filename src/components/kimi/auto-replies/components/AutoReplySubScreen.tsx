"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
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
    <div className="flex items-start justify-between gap-8 rounded-[12px] border border-border bg-card p-4 shadow-sm">
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{control}</div>
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
      className={`accordion-item rounded-[12px] border bg-card transition ${
        open ? "open border-indigo-200 shadow-sm" : "border-border hover:border-indigo-100"
      }`}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between px-5 py-4"
        onClick={onToggle}
      >
        <span className="flex items-center gap-3 text-[14.5px] font-medium text-foreground">
          {icon}
          {title}
        </span>
        <span className="text-muted-foreground">
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
      </button>
      {open ? <div className="border-t border-border px-5 pb-5 pt-4">{children}</div> : null}
    </div>
  );
}
