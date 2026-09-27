"use client";

import { FieldRow, Panel, Pill, type Tone } from "@/newui-transplant/components/app/kit";
import { Button as OpusButton } from "@/newui-transplant/components/ui/button";
import { Checkbox as OpusCheckbox } from "@/newui-transplant/components/ui/checkbox";
import { Input as OpusInput } from "@/newui-transplant/components/ui/input";
import { Label as OpusLabel } from "@/newui-transplant/components/ui/label";
import { Switch as OpusSwitch } from "@/newui-transplant/components/ui/switch";
import { Textarea as OpusTextarea } from "@/newui-transplant/components/ui/textarea";
import {
  Select as OpusSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/newui-transplant/components/ui/select";
import { Button as LegacyButton } from "@/components/ui/button";
import { Input as LegacyInput, Label as LegacyLabel, Textarea as LegacyTextarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type WizardPresentation = "legacy" | "mctb" | "opus";

export function isWizardOpus(presentation: WizardPresentation): boolean {
  return presentation === "opus";
}

export function pickWizardFieldComponents(presentation: WizardPresentation) {
  if (presentation === "opus") {
    return {
      presentation,
      isOpus: true,
      Input: OpusInput,
      Label: OpusLabel,
      Textarea: OpusTextarea,
      Button: OpusButton,
      Switch: OpusSwitch,
      Checkbox: OpusCheckbox,
      FieldRow,
      Panel,
      Pill,
    };
  }
  return {
    presentation,
    isOpus: false,
    Input: LegacyInput,
    Label: LegacyLabel,
    Textarea: LegacyTextarea,
    Button: LegacyButton,
    Switch: null as never,
    Checkbox: null as never,
    FieldRow: LegacyFieldRow,
    Panel: LegacyPanel,
    Pill: LegacyPill,
  };
}

function LegacyFieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function LegacyPanel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", className)}>
      {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
      {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </div>
  );
}

function LegacyPill({
  tone,
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
    neutral: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        styles[tone || "neutral"],
      )}
    >
      {children}
    </span>
  );
}

export function WizardSelectField({
  presentation,
  label,
  id,
  value,
  onChange,
  options,
  className,
}: {
  presentation: WizardPresentation;
  label: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
}) {
  const { Label: L } = pickWizardFieldComponents(presentation);
  if (presentation === "opus") {
    return (
      <div className={className}>
        <L className="text-xs" id={id}>
          {label}
        </L>
        <OpusSelect
          value={value}
          onValueChange={(next) => {
            if (next != null) onChange(String(next));
          }}
        >
          <SelectTrigger className="mt-1 h-9 w-full" aria-labelledby={id}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </OpusSelect>
      </div>
    );
  }
  const selectClass = "mt-1 h-10 w-full rounded-lg border border-border bg-card px-3 text-sm";
  return (
    <div className={className}>
      <L htmlFor={id}>{label}</L>
      <select
        id={id}
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function WizardToggleField({
  presentation,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  presentation: WizardPresentation;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  const ui = pickWizardFieldComponents(presentation);
  if (ui.isOpus) {
    return (
      <ui.FieldRow label={label} description={description}>
        <ui.Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
      </ui.FieldRow>
    );
  }
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span>
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function WizardHint({
  presentation,
  children,
}: {
  presentation: WizardPresentation;
  children: ReactNode;
}) {
  if (presentation === "opus") {
    return <p className="text-xs leading-relaxed text-muted-foreground">{children}</p>;
  }
  return (
    <div className="rounded-xl border border-accent/20 bg-accent/5 px-3.5 py-3 text-xs leading-relaxed text-foreground/80">
      {children}
    </div>
  );
}

export function WizardCheckboxInline({
  presentation,
  label,
  checked,
  onCheckedChange,
}: {
  presentation: WizardPresentation;
  label: string;
  checked: boolean;
  onCheckedChange: (on: boolean) => void;
}) {
  const ui = pickWizardFieldComponents(presentation);
  if (ui.isOpus && ui.Checkbox) {
    return (
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <ui.Checkbox checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
        <span>{label}</span>
      </label>
    );
  }
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
