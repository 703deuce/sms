import Link from "next/link";
import { QrCode } from "lucide-react";
import { Button, buttonVariants } from "@/newui-transplant/components/ui/button";
import { EmptyState, Pill, Stat, type Tone } from "@/newui-transplant/components/app/kit";
import { OPUS_CARD, OPUS_SEARCH_INPUT } from "@/newui-transplant/components/app/opus-surfaces";
import { cn } from "@/lib/utils";

export const qrUi = {
  green: "var(--primary)",
  greenDark: "var(--primary)",
  greenSoft: "color-mix(in oklch, var(--primary) 12%, transparent)",
  navy: "var(--foreground)",
  navySoft: "var(--muted-foreground)",
  ink: "var(--foreground)",
  muted: "var(--muted-foreground)",
  line: "var(--border)",
  pageBg: "transparent",
  card: OPUS_CARD,
  cardPad: cn(OPUS_CARD, "p-5"),
  title: "text-2xl font-semibold tracking-tight text-foreground",
  subtitle: "mt-1 text-sm leading-6 text-muted-foreground",
  label: "mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground",
  input: OPUS_SEARCH_INPUT,
  btnPrimary: cn(buttonVariants({ variant: "default" })),
  btnSecondary: cn(buttonVariants({ variant: "outline" })),
  btnGhost: cn(buttonVariants({ variant: "ghost" })),
  badgeActive: "",
  badgePaused: "",
  badgeDraft: "",
  kpi: cn(OPUS_CARD, "p-4"),
  section: "flex flex-col gap-4",
};

export const QR_MOCK_COLORS = [
  "#6366f1",
  "#2563EB",
  "#DC2626",
  "#EA580C",
  "#7C3AED",
  "#0F172A",
] as const;

function statusTone(status: string): Tone {
  const s = status.toLowerCase();
  if (s === "active") return "success";
  if (s === "paused") return "neutral";
  return "warning";
}

export function QrStatusBadge({ status }: { status: string }) {
  return <Pill tone={statusTone(status)}>{status}</Pill>;
}

export function QrKpiCard({
  label,
  value,
  hint,
  trend,
}: {
  label: string;
  value: string | number;
  hint?: string;
  trend?: string;
}) {
  const delta = trend && /^[+-]?\d/.test(trend) ? parseFloat(trend.replace(/[^\d.-]/g, "")) : undefined;
  return (
    <Stat
      label={label}
      value={String(value)}
      hint={hint ?? (trend && !delta ? trend : undefined)}
      delta={delta}
    />
  );
}

export function QrEmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn(OPUS_CARD, "overflow-hidden")}>
      <EmptyState icon={QrCode} title={title} description={body} action={action} />
    </section>
  );
}

export function QrUpgradeBanner({
  title,
  body,
  href,
}: {
  title: string;
  body: string;
  href: string;
}) {
  return (
    <section className={cn(OPUS_CARD, "border-primary/25 bg-primary/5 p-5")}>
      <Pill tone="success" className="mb-2">Upgrade</Pill>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{body}</p>
      <Button asChild className="mt-4">
        <Link href={href}>View plans</Link>
      </Button>
    </section>
  );
}
