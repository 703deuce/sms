"use client";

import { MctbPausedNotice } from "@/components/mctb/mctb-paused-notice";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addPauseUntil } from "@/lib/mctb/schedule-shared";
import { MCTB_ROUTES } from "@/lib/mctb/routes";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { traceMctbClient } from "@/lib/mctb/debug-client";
import "./kimi-ui/reference.css";

type ScheduleSlice = {
  paused: boolean;
  pauseUntil: string | null;
  pauseKind?: "manual" | "timed" | null;
};

export function MctbRecoveryControlsView() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pauseKind, setPauseKind] = useState<"manual" | "timed" | null>(null);
  const [pauseUntil, setPauseUntil] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("America/New_York");
  const [cooldownMinutes, setCooldownMinutes] = useState(60);
  const [enabled, setEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    traceMctbClient("schedule", "load_start");
    try {
      const res = await fetch("/api/mctb/setup", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.data?.runtime) return;
      const r = json.data.runtime;
      const sch = json.data.schedule as ScheduleSlice | undefined;
      setTimezone(r.timezone || "America/New_York");
      setCooldownMinutes(r.cooldownMinutes ?? 60);
      setEnabled(Boolean(r.enabled));
      setPauseKind(sch?.pauseKind ?? (sch?.paused ? "manual" : null));
      setPauseUntil(sch?.pauseUntil ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isPaused = useMemo(
    () =>
      pauseKind === "manual" ||
      Boolean(pauseKind === "timed" && pauseUntil && new Date(pauseUntil) > new Date()) ||
      !enabled,
    [pauseKind, pauseUntil, enabled],
  );

  const statusLabel = useMemo(() => {
    if (pauseKind === "manual" || !enabled) {
      return "Missed Call Text Back is paused until you resume";
    }
    if (pauseKind === "timed" && pauseUntil && new Date(pauseUntil) > new Date()) {
      return `Paused until ${new Date(pauseUntil).toLocaleString(undefined, {
        timeZone: timezone,
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
    }
    return "Missed Call Text Back is active";
  }, [pauseKind, pauseUntil, timezone, enabled]);

  async function saveCooldown() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cooldownMinutes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setMessage("Follow-up rules saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function pauseFor(duration: "1h" | "4h" | "tomorrow") {
    setSaving(true);
    setMessage("");
    try {
      const until = addPauseUntil(duration, timezone);
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pauseUntil: until }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pause failed");
      setPauseUntil(until);
      setPauseKind("timed");
      setEnabled(false);
      setMessage(`Paused until ${new Date(until).toLocaleString()}.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setSaving(false);
    }
  }

  async function pauseManual() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, pauseUntil: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Pause failed");
      setPauseUntil(null);
      setPauseKind("manual");
      setEnabled(false);
      setMessage("Missed Call Text Back paused until you resume.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setSaving(false);
    }
  }

  async function resume() {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/mctb/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, pauseUntil: null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Resume failed");
      setPauseUntil(null);
      setPauseKind(null);
      setEnabled(true);
      setMessage("Missed Call Text Back is active.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mctb-page">
        <div className="mctb-page-inner max-w-3xl">
          <div className="ref-card animate-pulse p-12" aria-busy="true" aria-label="Loading recovery controls" />
        </div>
      </div>
    );
  }

  return (
    <div className="mctb-page">
      <div className="mctb-page-inner max-w-3xl">
        <Link href={MCTB_ROUTES.setup} className="text-[13px] font-semibold text-indigo-600 hover:underline">
          ← Setup
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">
              Recovery controls
            </h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Pause automated recovery texts or adjust repeat-caller follow-up rules.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="ref-card p-5">
            <p className="text-sm font-semibold text-foreground">{statusLabel}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Pausing stops automated recovery texts. Carrier forwarding and missed-call logging may
              continue.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {isPaused ? (
                <Button type="button" size="sm" onClick={resume} disabled={saving}>
                  Resume now
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pauseFor("1h")}
                    disabled={saving}
                  >
                    Pause 1 hour
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pauseFor("4h")}
                    disabled={saving}
                  >
                    Pause 4 hours
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pauseFor("tomorrow")}
                    disabled={saving}
                  >
                    Until tomorrow 8 AM
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={pauseManual} disabled={saving}>
                    Pause until resumed
                  </Button>
                </>
              )}
            </div>
          </div>

          {isPaused ? (
            <MctbPausedNotice pauseKind={pauseKind} pauseUntil={pauseUntil} variant="banner" />
          ) : null}

          <div className="ref-card space-y-4 p-5">
            <div>
              <h2 className="mctb-section-title">Follow-up rules</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Repeat calls from the same person create separate missed-call events. Cooldown suppresses
                duplicate automated recovery texts.
              </p>
            </div>
            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="cooldown-minutes">Repeat-caller cooldown (minutes)</Label>
              <Input
                id="cooldown-minutes"
                type="number"
                min={0}
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(Number(e.target.value || 0))}
              />
            </div>
            <Button type="button" size="sm" onClick={saveCooldown} disabled={saving}>
              Save follow-up rules
            </Button>
          </div>

          {message ? (
            <p className="text-sm text-muted-foreground" role="status">{message}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
