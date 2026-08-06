"use client";

import Link from "next/link";
import { HIREABLE_AGENTS } from "@/lib/agents/catalog";
import { cn } from "@/lib/utils";

export function HireTeamChooser() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      <header className="space-y-3">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-slate-400">
          Build your communications team
        </p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Let’s put your first agent to work.
        </h1>
        <p className="max-w-2xl text-base text-slate-600">
          Start with an appointment booking agent or a missed-call recovery agent.
          You’re hiring an employee — not wiring Telnyx, webhooks, or prompts.
        </p>
      </header>

      <div className="grid gap-4">
        {HIREABLE_AGENTS.map((agent) => {
          const recommended = Boolean(agent.recommendedFirst);
          return (
            <Link
              key={agent.typeId}
              href={
                agent.typeId === "appointment_booking"
                  ? "/hire/brain?next=amy"
                  : agent.setupHref
              }
              className={cn(
                "block rounded-2xl border bg-white p-5 shadow-sm transition hover:border-slate-300",
                recommended ? "border-emerald-300 ring-1 ring-emerald-100" : "border-slate-200",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {recommended ? (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                      Recommended first
                    </p>
                  ) : null}
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    {agent.productName}{" "}
                    <span className="font-normal text-slate-500">— {agent.roleLabel}</span>
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">{agent.description}</p>
                </div>
                <span className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white">
                  Hire {agent.productName}
                </span>
              </div>
              <ul className="mt-4 grid gap-1 text-[12px] text-slate-500 sm:grid-cols-2">
                {agent.fixedCapabilities.slice(0, 4).map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </Link>
          );
        })}
      </div>

      <p className="text-sm text-slate-500">
        Already have agents?{" "}
        <Link href="/agents" className="font-semibold text-blue-600">
          Open Your Team
        </Link>
      </p>
    </div>
  );
}
