"use client";

import type { DashboardDateRange } from "@/lib/outcomes/operational-dashboard-types";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  PhoneMissed,
  Send,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type DashboardProps = {
  userName: string;
  range: DashboardDateRange;
};

type SetupSummary = {
  compliance: { messagingReady: boolean; requiredActions: string[] };
  runtime: { enabled: boolean; phoneNumberId: string | null };
};

type MissedSummary = {
  missedToday: number;
  sentToday: number;
  repliedToday: number;
};

export function MctbDashboardView({ userName, range }: DashboardProps) {
  const [setup, setSetup] = useState<SetupSummary | null>(null);
  const [missed, setMissed] = useState<MissedSummary | null>(null);

  useEffect(() => {
    fetch("/api/mctb/setup", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) {
          setSetup({
            compliance: j.data.compliance,
            runtime: {
              enabled: j.data.runtime.enabled,
              phoneNumberId: j.data.runtime.phoneNumberId,
            },
          });
        }
      })
      .catch(() => undefined);
    fetch("/api/mctb/missed-calls?limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setMissed(j.data?.summary || null))
      .catch(() => undefined);
  }, []);

  const needsCompliance = setup && !setup.compliance.messagingReady;
  const needsSetup = setup && !setup.runtime.phoneNumberId;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
          Good {range === "today" ? "day" : "morning"}, {userName.split(" ")[0] || "there"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Is missed-call recovery working? Track texts sent, replies, and setup health.
        </p>
      </div>

      {needsCompliance ? (
        <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold text-amber-950">Messaging setup incomplete</p>
              <p className="mt-0.5 text-[13px] text-amber-900">
                Complete verification before missed-call text back can go live.
              </p>
              {setup.compliance.requiredActions.slice(0, 2).map((a) => (
                <p key={a} className="mt-1 text-[12px] text-amber-800">
                  • {a}
                </p>
              ))}
            </div>
          </div>
          <Link
            href="/compliance"
            className="inline-flex h-9 shrink-0 items-center gap-1 rounded-lg bg-amber-900 px-4 text-[13px] font-semibold text-white hover:bg-amber-800"
          >
            <ShieldCheck className="h-4 w-4" />
            Messaging Compliance
          </Link>
        </div>
      ) : null}

      {needsSetup ? (
        <div className="flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-indigo-950">Finish your setup</p>
            <p className="mt-0.5 text-[13px] text-indigo-900">
              Choose a business number and configure your text-back message.
            </p>
          </div>
          <Link
            href="/voice/setup"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-4 text-[13px] font-semibold text-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Open Setup
          </Link>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Missed today",
            value: missed?.missedToday ?? 0,
            icon: PhoneMissed,
            href: "/voice/missed-calls",
          },
          {
            label: "Texts sent today",
            value: missed?.sentToday ?? 0,
            icon: Send,
            href: "/voice/missed-calls",
          },
          {
            label: "Replies today",
            value: missed?.repliedToday ?? 0,
            icon: MessageSquare,
            href: "/voice/conversations",
          },
          {
            label: "Recovery status",
            value: setup?.runtime.enabled ? "Active" : "Paused",
            icon: SlidersHorizontal,
            href: "/voice/setup",
            text: true,
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="voice-card block p-5 transition hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <p
                className={cn(
                  "mt-2 font-bold text-[#111827]",
                  card.text ? "text-lg" : "text-2xl tabular-nums",
                )}
              >
                {card.value}
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="voice-card p-6">
          <h2 className="text-sm font-semibold text-[#111827]">Quick actions</h2>
          <ul className="mt-4 space-y-2">
            {[
              { label: "Configure missed-call rules", href: "/voice/setup" },
              { label: "View missed call history", href: "/voice/missed-calls" },
              { label: "Reply to callers", href: "/voice/conversations" },
              { label: "Complete messaging compliance", href: "/compliance" },
            ].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#f9fafb]"
                >
                  {item.label}
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="voice-card p-6">
          <h2 className="text-sm font-semibold text-[#111827]">Onboarding checklist</h2>
          <ol className="mt-4 space-y-3 text-[13px]">
            {[
              { label: "Create account", done: true },
              { label: "Connect a business number", done: !needsSetup, href: "/voice/numbers" },
              { label: "Configure missed-call setup", done: !needsSetup, href: "/voice/setup" },
              {
                label: "Complete A2P / toll-free verification",
                done: !needsCompliance,
                href: "/compliance",
              },
              { label: "Run a live test call", done: (missed?.sentToday ?? 0) > 0, href: "/voice/setup#test" },
              { label: "Activate recovery", done: setup?.runtime.enabled, href: "/voice/setup" },
            ].map((step) => (
              <li key={step.label} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    step.done ? "bg-emerald-100 text-emerald-700" : "bg-[#f3f4f6] text-[#9ca3af]",
                  )}
                >
                  {step.done ? "✓" : "·"}
                </span>
                {step.href && !step.done ? (
                  <Link href={step.href} className="font-medium text-primary hover:underline">
                    {step.label}
                  </Link>
                ) : (
                  <span className={step.done ? "text-[#374151]" : "text-muted-foreground"}>
                    {step.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
