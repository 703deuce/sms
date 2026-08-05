"use client";

import type { MyNumberCard } from "@/lib/numbers/load-my-numbers";
import { cn, formatPhone } from "@/lib/utils";
import { MessageSquare, Phone, PhoneForwarded, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

function StatusPill({ status }: { status: string }) {
  const live = status === "Live";
  const attention = status === "Needs attention";
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2 text-[11px] font-semibold",
        live && "bg-emerald-50 text-emerald-700",
        attention && "bg-amber-50 text-amber-800",
        !live && !attention && "bg-slate-100 text-slate-600",
      )}
    >
      {status}
    </span>
  );
}

function NumberCard({ card }: { card: MyNumberCard }) {
  const Icon = card.kind === "external" ? PhoneForwarded : Phone;
  return (
    <article className="flex flex-col rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[#111827]">
              {formatPhone(card.e164)}
            </h2>
            <p className="mt-0.5 text-[12px] font-medium text-[#6B7280]">
              {card.displayName}
            </p>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">{card.ownershipLabel}</p>
          </div>
        </div>
        <StatusPill status={card.status} />
      </div>

      {card.relatedLabel ? (
        <p className="mt-4 text-[12px] text-[#4B5563]">
          <span className="font-semibold text-[#111827]">
            {card.kind === "external" ? "Forwards to:" : "Connected through:"}
          </span>{" "}
          {card.relatedE164 ? formatPhone(card.relatedE164) : null}
          {card.relatedE164 ? " — " : null}
          {card.relatedLabel}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            Voice agent
          </p>
          {card.voiceAgents.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {card.voiceAgents.map((a) => (
                <li key={a.deploymentId} className="text-[12px] text-[#111827]">
                  <Link href={a.href} className="font-semibold hover:underline">
                    {a.agentName}
                  </Link>
                  <span className="block text-[11px] text-[#6B7280]">
                    {a.agentTypeLabel} · {a.scheduleLabel} · {a.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#6B7280]">No voice agent</p>
          )}
        </div>
        <div className="rounded-lg bg-[#F9FAFB] p-3">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
            <MessageSquare className="h-3 w-3" /> SMS agent
          </p>
          {card.kind === "external" ? (
            <p className="mt-1.5 text-[12px] text-[#6B7280]">
              SMS does not follow call forwarding
            </p>
          ) : card.smsAgents.length ? (
            <ul className="mt-1.5 space-y-1.5">
              {card.smsAgents.map((a) => (
                <li key={a.deploymentId} className="text-[12px] text-[#111827]">
                  <Link href={a.href} className="font-semibold hover:underline">
                    {a.agentName}
                  </Link>
                  <span className="block text-[11px] text-[#6B7280]">
                    {a.agentTypeLabel} · {a.statusLabel}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-[12px] text-[#6B7280]">No SMS agent</p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
            card.readiness.voiceReady
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-800",
          )}
        >
          {card.readiness.voiceLabel}
        </span>
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
            card.readiness.messagingReady
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-600",
          )}
        >
          {card.readiness.messagingLabel}
        </span>
      </div>

      {card.note ? (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-[#6B7280]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          {card.note}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-[#F3F4F6] pt-4">
        <Link
          href={card.href}
          className="inline-flex h-9 items-center rounded-md bg-[#111827] px-3 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
        >
          Manage number
        </Link>
        <Link
          href="/systems"
          className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold text-[#2563EB] ring-1 ring-[#BFDBFE] hover:bg-[#EFF6FF]"
        >
          View agents
        </Link>
        {card.kind === "transovo" ? (
          <Link
            href={`/numbers/${card.id}`}
            className="inline-flex h-9 items-center rounded-md px-3 text-[12px] font-semibold text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50"
          >
            Test / provision
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function MyNumbersView({
  cards,
  summary,
}: {
  cards: MyNumberCard[];
  summary: {
    total: number;
    live: number;
    needsAttention: number;
    messagingReadyCount: number;
  };
}) {
  const [filter, setFilter] = useState<"all" | "transovo" | "external" | "attention">(
    "all",
  );

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      if (filter === "transovo") return c.kind === "transovo";
      if (filter === "external") return c.kind === "external";
      if (filter === "attention") {
        return (
          c.status === "Needs attention" ||
          !c.readiness.voiceReady ||
          (c.kind === "external" && c.forwardingStatus !== "active")
        );
      }
      return true;
    });
  }, [cards, filter]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight text-[#111827]">
          My Numbers
        </h1>
        <p className="mt-1.5 max-w-3xl text-[14px] text-[#6B7280]">
          What phone numbers you have and what each one is connected to. Agents do
          the work — numbers receive the calls and texts. Deployments connect them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Numbers", value: summary.total },
          { label: "Live", value: summary.live },
          { label: "Needs attention", value: summary.needsAttention },
          { label: "SMS-ready", value: summary.messagingReadyCount },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
              {m.label}
            </p>
            <p className="mt-1 text-[22px] font-bold text-[#111827]">{m.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All"],
            ["transovo", "Transovo numbers"],
            ["external", "Customer numbers"],
            ["attention", "Needs attention"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition",
              filter === id
                ? "bg-[#111827] text-white"
                : "bg-white text-[#4B5563] ring-1 ring-[#E5E7EB] hover:bg-slate-50",
            )}
          >
            {label}
          </button>
        ))}
        <Link
          href="/numbers/buy"
          className="ml-auto inline-flex h-8 items-center rounded-full bg-[#3B82F6] px-3 text-[12px] font-semibold text-white hover:bg-[#2563EB]"
        >
          Buy Transovo number
        </Link>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white px-6 py-16 text-center">
          <p className="text-[14px] font-medium text-[#111827]">No numbers yet</p>
          <p className="mt-1 text-[13px] text-[#6B7280]">
            Buy a Transovo number, then connect an agent from My Agents.
          </p>
          <Link
            href="/numbers/buy"
            className="mt-4 inline-flex h-9 items-center rounded-md bg-[#111827] px-4 text-[12px] font-semibold text-white"
          >
            Buy number
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((card) => (
            <NumberCard key={`${card.kind}-${card.id}`} card={card} />
          ))}
        </div>
      )}
    </div>
  );
}
