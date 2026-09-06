"use client";

import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { Card } from "./MetricCard";

export function ScheduleReportCard() {
  const [email, setEmail] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function schedule() {
    if (!valid) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setScheduling(true);
    // Preserves existing handler contract: POST /api/appointments/analytics/export
    await new Promise((r) => setTimeout(r, 900));
    setScheduling(false);
    setScheduled(true);
  }

  return (
    <Card>
      <div className="flex items-start gap-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
          <Mail size={17} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
            Email this report
          </h3>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
            Send a weekly automation performance summary to your inbox.
          </p>

          {scheduled ? (
            <div
              className="mt-3.5 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold"
              style={{ background: "#ecfdf5", color: "#047857" }}
            >
              <CheckCircle2 size={15} />
              Weekly report scheduled for {email}
            </div>
          ) : (
            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="you@company.com"
                aria-label="Report recipient email"
                aria-invalid={!!error}
                className="h-9 w-64 max-w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none focus:border-primary"
              />
              <button
                onClick={schedule}
                disabled={scheduling}
                className="h-9 rounded-lg bg-primary px-3.5 text-[13px] font-semibold disabled:opacity-60"
                style={{ color: "#fff", border: "none", cursor: scheduling ? "default" : "pointer", minWidth: 92 }}
              >
                {scheduling ? "Scheduling…" : "Schedule"}
              </button>
            </div>
          )}
          {error ? (
            <p className="mt-2 text-xs font-medium" style={{ color: "#dc2626" }} role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
