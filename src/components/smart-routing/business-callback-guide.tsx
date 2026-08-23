"use client";

import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { Phone } from "lucide-react";

export function BusinessCallbackGuide({
  businessNumber,
  routingNumber,
  verified,
}: {
  businessNumber: string;
  routingNumber: string;
  verified: boolean;
}) {
  const steps = [
    {
      n: 1,
      text: `Call your Routing Number: ${fmtPhoneDisplay(routingNumber)}`,
    },
    { n: 2, text: "Enter your PIN when prompted." },
    {
      n: 3,
      text: "Choose: 1 — Latest missed call · 2 — Latest voicemail · 3 — Callback request · 4 — Enter another number",
    },
    {
      n: 4,
      text: `The customer sees ${fmtPhoneDisplay(businessNumber)} — your verified business number.`,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">How to return a call</h3>
        <p className="mt-1 text-xs text-muted-foreground">No app required.</p>
      </div>
      {!verified ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Verify your business number to enable outbound Business Callback.
        </p>
      ) : null}
      <ol className="space-y-3">
        {steps.map((s) => (
          <li key={s.n} className="flex gap-3 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
              {s.n}
            </span>
            <span className="text-muted-foreground">{s.text}</span>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <Phone className="h-4 w-4" />
        Authorized team members call the same Routing Number customers reach via forwarding.
      </div>
    </div>
  );
}
