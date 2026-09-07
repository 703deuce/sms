import { useState } from "react";
import type { BookingType } from "../mock-data";
import { Button, Input, Label } from "./ui";
import { ArrowLeft, BellRing, Check } from "lucide-react";

export function WaitlistStep({
  type,
  onBack,
  onJoin,
  submitting = false,
  error = "",
}: {
  type: BookingType | null;
  onBack: () => void;
  onJoin?: (payload: { name: string; phone: string }) => void | Promise<void>;
  submitting?: boolean;
  error?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [localSubmitting, setLocalSubmitting] = useState(false);
  const [joined, setJoined] = useState(false);
  const [localError, setLocalError] = useState("");

  async function joinWaitlist() {
    setLocalError("");
    if (!name.trim()) return setLocalError("Enter your name.");
    if (phone.replace(/\D/g, "").length < 10) return setLocalError("Enter a complete mobile number.");
    if (onJoin) {
      await onJoin({ name, phone });
      setJoined(true);
      return;
    }
    setLocalSubmitting(true);
    await new Promise((r) => setTimeout(r, 900));
    setLocalSubmitting(false);
    setJoined(true);
  }

  const busy = submitting || localSubmitting;
  const displayError = error || localError;

  if (joined) {
    return (
      <div className="fade-in text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
          <Check className="h-6 w-6" />
        </div>
        <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
          You're on the waitlist
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] text-muted-foreground">
          We'll text {phone} as soon as a spot opens up{type ? ` for ${type.name}` : ""}. First come, first served — reply fast to claim it.
        </p>
        <Button variant="outline" className="mt-5" onClick={onBack}>Back to booking</Button>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <BellRing className="h-5 w-5" />
      </div>
      <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
        Join the waitlist
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        No openings that work? We'll text you the moment a spot opens{type ? ` for ${type.name}` : ""}.
      </p>
      <div className="mt-5 space-y-4">
        <div>
          <Label htmlFor="wl-name">Full name</Label>
          <Input id="wl-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="wl-phone">Mobile number</Label>
          <Input id="wl-phone" type="tel" autoComplete="tel" placeholder="(615) 555-0142" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      {displayError ? <p className="mt-3 text-sm text-rose-600" role="alert">{displayError}</p> : null}
      <Button size="lg" className="mt-5 w-full" onClick={joinWaitlist} disabled={busy}>
        {busy ? "Joining…" : "Join waitlist"}
      </Button>
    </div>
  );
}
