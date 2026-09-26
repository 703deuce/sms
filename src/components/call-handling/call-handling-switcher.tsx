"use client";

import type { ActiveCallHandler, CallHandlingOwnershipState } from "@/lib/call-handling/types";
import { cn } from "@/lib/utils";
import { Bot, Check, ChevronDown, PhoneMissed } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  collapsed?: boolean;
  className?: string;
  variant?: "sidebar" | "header" | "card";
  onNavigate?: () => void;
};

const HANDLER_LABEL: Record<ActiveCallHandler, string> = {
  ai_receptionist: "AI Receptionist",
  mctb: "Missed Call Text Back",
};

const HANDLER_DESC: Record<ActiveCallHandler, string> = {
  ai_receptionist: "AI answers your forwarded calls.",
  mctb: "Missed calls use voicemail and text-back recovery.",
};

function displayHandler(state: CallHandlingOwnershipState | null): ActiveCallHandler | null {
  if (!state) return null;
  return state.effectiveHandler ?? state.selectedHandler;
}

export function CallHandlingSwitcher({
  collapsed = false,
  className,
  variant = "sidebar",
  onNavigate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<CallHandlingOwnershipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/call-handling", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new Error(json.error || "Could not load call handling");
      }
      setState(json.data);
    } catch (err) {
      setState(null);
      setError(err instanceof Error ? err.message : "Could not load call handling");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = displayHandler(state);
  const busy = switching || state?.switching;

  async function selectHandler(next: ActiveCallHandler) {
    if (!state || busy || active === next) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    setError(null);
    try {
      const res = await fetch("/api/call-handling", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handler: next, phoneNumberId: state.phoneNumberId }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.data) setState(json.data);
        throw new Error(json.error || "Switch did not complete");
      }
      setState(json.data);
      setOpen(false);
      onNavigate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Switch did not complete");
    } finally {
      setSwitching(false);
    }
  }

  if (loading && !state) {
    return (
      <div
        className={cn("px-2 pb-2", className)}
        aria-busy="true"
        aria-label="Call handling loading"
      >
        <div
          className={cn(
            "w-full animate-pulse rounded-[10px] bg-[#e8ebf0]",
            collapsed ? "h-10" : "h-[52px]",
          )}
        />
      </div>
    );
  }

  if (!state) {
    return null;
  }

  const compact = variant === "header";
  const label = active ? HANDLER_LABEL[active] : "Not set";

  return (
    <div ref={rootRef} className={cn("relative shrink-0", compact ? "" : "px-2 pb-2", className)}>
      <button
        type="button"
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-[10px] border border-[#e6e8ef] bg-[#f8f9fc] text-left transition hover:border-primary/30 hover:bg-[#f3f4ff]",
          collapsed ? "justify-center px-2 py-2" : "px-2.5 py-2",
          busy && "opacity-70",
        )}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Call handling: ${label}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {active === "mctb" ? (
            <PhoneMissed className="h-4 w-4" aria-hidden />
          ) : (
            <Bot className="h-4 w-4" aria-hidden />
          )}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted">
                Call handling
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-semibold text-[#111827]">
                {busy ? "Switching call handling…" : label}
              </span>
            </span>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-sidebar-muted transition", open && "rotate-180")}
              aria-hidden
            />
          </>
        ) : null}
      </button>

      {error ? (
        <p className="mt-1 px-1 text-[11px] text-destructive" role="alert">{error}</p>
      ) : null}

      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1 w-[min(100%,280px)] rounded-xl border border-[#e6e8ef] bg-white p-2 shadow-lg",
            compact ? "left-0" : "left-2 right-2",
          )}
          role="listbox"
          aria-label="Call handling options"
        >
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]">
            Call handling
          </p>
          {(["ai_receptionist", "mctb"] as ActiveCallHandler[]).map((handler) => {
            const selected = active === handler;
            return (
              <button
                key={handler}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={busy}
                className={cn(
                  "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-[#f3f4ff]",
                  selected && "bg-[#f3f4ff]",
                )}
                onClick={() => void selectHandler(handler)}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {selected ? <Check className="h-4 w-4 text-primary" aria-hidden /> : null}
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-[#111827]">
                    {HANDLER_LABEL[handler]}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#6b7280]">
                    {HANDLER_DESC[handler]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function CallHandlingDashboardCard({ className }: { className?: string }) {
  const [state, setState] = useState<CallHandlingOwnershipState | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchOpen, setSwitchOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/call-handling", { cache: "no-store" });
      const json = await res.json();
      if (res.ok && json.data) setState(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !state) return null;

  const active = displayHandler(state);
  if (!active) return null;

  const manageHref =
    active === "mctb" ? "/mctb/setup" : "/solutions/ai-call-handling/appointment-assistant/setup";

  return (
    <section
      className={cn(
        "mctb-home-surface flex flex-col gap-3 px-5 py-4 lg:col-span-12",
        className,
      )}
      aria-labelledby="call-handling-dashboard-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            id="call-handling-dashboard-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#6b7280]"
          >
            Call handling
          </p>
          <p className="mt-1 text-[17px] font-semibold text-[#1b1e23]">
            {HANDLER_LABEL[active]}
            <span className="ml-2 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
              Active
            </span>
          </p>
          <p className="mt-1 text-[13px] text-[#4b5563]">
            {active === "ai_receptionist"
              ? "Your AI Receptionist is currently answering forwarded calls."
              : "Missed calls are currently using your voicemail and text-back recovery settings."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={manageHref}
            className="inline-flex h-9 items-center rounded-lg border border-[#e5e8eb] px-3 text-[13px] font-medium text-[#1b1e23] hover:bg-[#f8f9fc]"
          >
            {active === "mctb" ? "Manage Missed Call Text Back" : "Manage AI Receptionist"}
          </Link>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-lg bg-[#1b1e23] px-3 text-[13px] font-medium text-white hover:bg-[#262a31]"
            onClick={() => setSwitchOpen((v) => !v)}
          >
            Switch
          </button>
        </div>
      </div>
      {switchOpen ? (
        <CallHandlingSwitcher variant="card" className="!px-0 !pb-0" />
      ) : null}
      {state.drift && state.error ? (
        <p className="text-[12px] text-amber-800" role="status">{state.error}</p>
      ) : null}
    </section>
  );
}
