"use client";

import { BusinessCallBackButton } from "@/components/smart-routing/business-call-back-button";
import { SrPrimaryButton, srCard } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import { cn } from "@/lib/utils";
import { useState } from "react";

type Caller = {
  id: string;
  name: string;
  phoneE164: string;
  preferredCallbackPhoneE164?: string | null;
  active: boolean;
  outboundEnabled: boolean;
};

export function OneClickBusinessCallbackPanel({
  businessLabel,
  businessNumberE164,
  verified,
  authorizedCallers,
  defaultCallerId,
}: {
  businessLabel: string;
  businessNumberE164: string;
  verified: boolean;
  authorizedCallers: Caller[];
  defaultCallerId?: string;
}) {
  const [destination, setDestination] = useState("");
  const [callerId, setCallerId] = useState(defaultCallerId ?? "");
  const [showDial, setShowDial] = useState(false);

  const activeCallers = authorizedCallers.filter((c) => c.active && c.outboundEnabled);
  const selected = activeCallers.find((c) => c.id === callerId) ?? activeCallers[0];

  if (!verified || !activeCallers.length) return null;

  return (
    <div className={cn(srCard, "p-5")}>
      <h2 className="text-base font-semibold text-[#111827]">One-Click Business Callback</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Transovo calls your phone first. Press 1 to confirm, then we connect the customer while
        showing your business number — no app or softphone required.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Call from</label>
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={callerId || selected?.id || ""}
            onChange={(e) => setCallerId(e.target.value)}
          >
            {activeCallers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {fmtPhoneDisplay(c.preferredCallbackPhoneE164 || c.phoneE164)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Call as</label>
          <p className="mt-1 rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium">
            {businessLabel}
            {businessNumberE164 ? ` · ${fmtPhoneDisplay(businessNumberE164)}` : ""}
          </p>
        </div>
      </div>

      {showDial ? (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Customer number</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm font-mono"
              placeholder="+1…"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          {destination.trim() ? (
            <BusinessCallBackButton
              destinationE164={destination.trim()}
              contextType="manual"
              className="max-w-sm"
            />
          ) : (
            <SrPrimaryButton type="button" disabled className="opacity-50">
              Enter a customer number
            </SrPrimaryButton>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="mt-4 text-sm font-semibold text-primary hover:underline"
          onClick={() => setShowDial(true)}
        >
          Dial a number manually →
        </button>
      )}
    </div>
  );
}
