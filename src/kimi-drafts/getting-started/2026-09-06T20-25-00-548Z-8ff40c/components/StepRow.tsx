import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Building2,
  CalendarPlus,
  CalendarSync,
  Check,
  Clock,
  Globe,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SetupStep } from "../mock-data";

const ICONS: Record<string, LucideIcon> = {
  UserCheck,
  Building2,
  CalendarPlus,
  Clock,
  Globe,
  CalendarSync,
  BellRing,
  Users,
  ShieldCheck,
  Sparkles,
};

export function StepRow({
  step,
  isNext,
}: {
  step: SetupStep;
  isNext: boolean;
}) {
  const Icon = ICONS[step.icon] ?? Sparkles;

  const inner = (
    <>
      <span
        className={`gs-check ${step.done ? "gs-check--done" : "gs-check--todo"}`}
        aria-hidden
      >
        {step.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </span>

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span
            className={`text-[13.5px] font-semibold tracking-tight ${
              step.done ? "text-muted-foreground line-through decoration-border" : "text-foreground"
            }`}
          >
            {step.label}
          </span>
          {step.optional ? (
            <span className="rounded-full border border-border bg-muted px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Optional
            </span>
          ) : null}
          {isNext && !step.done ? (
            <span className="rounded-full bg-primary/10 px-2 py-px text-[10.5px] font-semibold text-primary">
              Up next
            </span>
          ) : null}
        </span>
        <span
          className={`mt-0.5 block text-[12.5px] leading-relaxed ${
            step.done ? "text-muted-foreground/80" : "text-muted-foreground"
          }`}
        >
          {step.description}
        </span>
      </span>

      {!step.done && step.href ? (
        <span className="mt-1 flex shrink-0 items-center gap-1 text-[12px] font-semibold text-primary">
          {isNext ? "Start" : "Open"}
          {isNext ? (
            <ArrowRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpRight className="h-3.5 w-3.5" />
          )}
        </span>
      ) : null}
    </>
  );

  if (!step.done && step.href) {
    return (
      <a href={step.href} className="gs-step" aria-label={`${step.label} — ${step.description}`}>
        {inner}
      </a>
    );
  }
  return (
    <div className="gs-step" aria-current={isNext ? "step" : undefined}>
      {inner}
    </div>
  );
}
