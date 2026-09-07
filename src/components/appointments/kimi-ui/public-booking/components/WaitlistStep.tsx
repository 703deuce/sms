"use client";

import { useState } from "react";
import { bookingTypes, workspace } from "../mock-data";
import { ArrowLeft, BellRing, Check } from "lucide-react";

export function WaitlistStep({ onBack }: { onBack: () => void }) {
  const [typeId, setTypeId] = useState(bookingTypes[0].id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [timeframe, setTimeframe] = useState("mornings");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const valid = name.trim() && phone.trim().length >= 7;

  async function join() {
    if (!valid || submitting) return;
    setSubmitting(true);
    // POST /api/public/book/{slug}/waitlist
    await new Promise((r) => setTimeout(r, 1000));
    setSubmitting(false);
    setDone(true);
  }

  const inputCls =
    "mt-1.5 w-full rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (done) {
    return (
      <div className="tv-fade-up mx-auto max-w-md">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600" style={{ boxShadow: "0 0 0 8px rgba(16,185,129,0.08)" }}>
            <Check className="h-6 w-6" />
          </div>
          <h1 className="font-display text-[18px] font-semibold text-foreground">You're on the waitlist</h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            We'll text <span className="font-medium text-foreground">{phone}</span> as soon as a matching opening appears at {workspace.name}. You'll be able to claim it with one tap.
          </p>
          <button
            onClick={onBack}
            className="mt-6 rounded-lg px-5 py-2 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95"
            style={{ background: "var(--primary)" }}
          >
            Back to services
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tv-fade-up mx-auto max-w-md">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to services
      </button>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BellRing className="h-5 w-5" />
          </span>
          <div>
            <h1 className="font-display text-[17px] font-semibold text-foreground">Join the waitlist</h1>
            <p className="text-[12px] text-muted-foreground">Get first dibs when a spot opens up.</p>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="wl-type" className="text-[12px] font-semibold text-foreground">Service</label>
            <select id="wl-type" className={inputCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {bookingTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="wl-name" className="text-[12px] font-semibold text-foreground">Full name <span className="text-danger">*</span></label>
            <input id="wl-name" autoComplete="name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="wl-phone" className="text-[12px] font-semibold text-foreground">Mobile number <span className="text-danger">*</span></label>
            <input id="wl-phone" type="tel" autoComplete="tel" placeholder="(555) 123-4567" className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <span className="text-[12px] font-semibold text-foreground">Preferred times</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {["mornings", "midday", "afternoons", "any time"].map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={timeframe === t}
                  onClick={() => setTimeframe(t)}
                  className={`rounded-lg border px-3 py-2 text-[12px] font-medium capitalize transition-colors ${
                    timeframe === t ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:bg-muted/60"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={join}
          disabled={!valid || submitting}
          className="mt-6 w-full rounded-lg px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-95 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {submitting ? "Joining…" : "Join waitlist"}
        </button>
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          We'll only contact you about openings for this service.
        </p>
      </div>
    </div>
  );
}
