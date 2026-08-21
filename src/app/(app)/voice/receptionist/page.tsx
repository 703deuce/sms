"use client";

import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import {
  ArrowRight,
  Bot,
  Calendar,
  MessageCircle,
  Phone,
  PhoneForwarded,
  Plus,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type AgentRow = {
  id: string;
  name: string;
  status: string;
  callsHandled: number;
  healthStatus: string;
  updatedAt: string;
  phoneNumberId: string | null;
  phoneE164: string | null;
};

const QUICK_LINKS = [
  {
    label: "About Your Receptionist",
    description: "Name, business details, and how Amy should answer",
    href: (id: string) => `/voice/agents/${id}/about`,
    icon: Bot,
  },
  {
    label: "What It Should Do",
    description: "Capabilities and caller information to collect",
    href: (id: string) => `/voice/agents/${id}/capabilities`,
    icon: MessageCircle,
  },
  {
    label: "Connect integrations",
    description: "Calendars, CRM, and booking tools",
    href: (id: string) => `/voice/agents/${id}/integrations`,
    icon: Calendar,
  },
  {
    label: "Voice & Test",
    description: "Pick LiveKit template, choose voice, test call, assign number",
    href: (id: string) => `/voice/agents/${id}/voice-test`,
    icon: Phone,
  },
  {
    label: "Advanced",
    description: "Routing, transfers, and fine-tuned behavior",
    href: (id: string) => `/voice/agents/${id}/advanced`,
    icon: Wrench,
  },
] as const;

function rankStatus(status: string): number {
  if (status === "ACTIVE") return 0;
  if (status === "TESTING") return 1;
  if (status === "DRAFT") return 2;
  if (status === "PAUSED") return 3;
  return 4;
}

export default function ReceptionistLandingPage() {
  const [rows, setRows] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/voice/agents")
      .then((r) => r.json())
      .then((j) => setRows(j.data || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const dr = rankStatus(a.status) - rankStatus(b.status);
      if (dr !== 0) return dr;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [rows]);

  const primary = sorted[0] ?? null;
  const recent = sorted.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[#111827]">
            AI Receptionist
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Your AI receptionist answers calls, collects caller details, books appointments, and
            transfers urgent callers. Jump straight to any setup step — no need to replay the
            wizard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/voice/agents">
            <Button variant="outline" className="gap-2">
              My Agents
            </Button>
          </Link>
          <Link href="/voice/agents/new">
            <Button className="gap-2 bg-primary hover:bg-primary-hover">
              <Plus className="h-4 w-4" />
              Create New Agent
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="voice-card p-6 lg:col-span-2">
          <h2 className="text-sm font-semibold text-[#111827]">What your receptionist can do</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              "Answer business questions from your knowledge",
              "Take messages and capture inquiries",
              "Collect caller name, phone, and custom fields",
              "Book appointments from live calendars",
              "Transfer qualifying calls to your team",
              "Send SMS confirmations and follow-ups",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-[#374151]">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="voice-card flex flex-col p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <PhoneForwarded className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Quick start</p>
              <p className="text-xs text-muted-foreground">~10 minutes to go live</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {primary
              ? `Edit ${primary.name} below or create another receptionist for a new number or location.`
              : "Create your first receptionist in three steps — about your business, capabilities, and voice."}
          </p>
          <Link
            href={primary ? `/voice/agents/${primary.id}/about` : "/voice/agents/new"}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary-hover"
          >
            {primary ? "Open primary agent" : "Start setup"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {primary ? (
        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#111827]">Edit {primary.name}</h2>
            <Link
              href={`/voice/agents/${primary.id}/about`}
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              Open full editor →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.label}
                  href={link.href(primary.id)}
                  className="voice-card block p-5 transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-[#111827]">{link.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-[#111827]">
            {loading ? "Recent agents" : recent.length ? "Recent agents" : "Your agents"}
          </h2>
          {recent.length > 0 ? (
            <Link
              href="/voice/agents"
              className="text-sm font-medium text-primary hover:text-primary-hover"
            >
              View all →
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="voice-card px-6 py-10 text-center text-sm text-muted-foreground">
            Loading agents…
          </div>
        ) : recent.length === 0 ? (
          <div className="voice-card flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-6 text-lg font-semibold">No receptionist yet</h3>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Create your AI receptionist in three quick steps — about your business, what it
              should do, and voice &amp; test.
            </p>
            <Link href="/voice/agents/new" className="mt-6 voice-btn-primary">
              Create New Agent
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {recent.map((a) => (
              <Link
                key={a.id}
                href={`/voice/agents/${a.id}/about`}
                className="voice-card block p-6 transition hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-lg font-bold text-white">
                      {a.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.callsHandled} calls handled
                      </p>
                    </div>
                  </div>
                  <StatusChip status={a.status} />
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  {a.phoneE164 ? (
                    <span className="font-medium text-foreground">{a.phoneE164}</span>
                  ) : (
                    <span className="text-muted-foreground">No number assigned</span>
                  )}
                </div>
                <p className="mt-3 text-sm font-medium text-primary">Open agent →</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
