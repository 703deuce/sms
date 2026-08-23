"use client";

import { Button } from "@/components/ui/button";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";
import type { ForwardingMode } from "@/lib/smart-routing/forwarding-service";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

type ForwardingGuide = {
  carrier: string;
  modes: Record<string, { label: string; dialCode: string; notes?: string }>;
};

const CARRIERS = ["Verizon", "AT&T", "T-Mobile", "Spectrum", "Comcast", "Other"];

export function ForwardingSetupPanel({
  businessNumber,
  routingNumber,
  forwardingGuides,
  forwardingDetected,
  forwardingTest,
  flowId,
  onUpdated,
}: {
  businessNumber: string;
  routingNumber: string;
  forwardingGuides: ForwardingGuide[] | null;
  forwardingDetected: boolean;
  forwardingTest: {
    detected: boolean;
    at?: string;
    forwardedFrom?: string | null;
    callerNumber?: string | null;
  };
  flowId?: string;
  onUpdated: () => void;
}) {
  const [carrier, setCarrier] = useState("Verizon");
  const [mode, setMode] = useState<ForwardingMode>("unconditional");
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const guide =
    forwardingGuides?.find((g) => g.carrier === carrier) ??
    forwardingGuides?.find((g) => g.carrier === "Other");
  const modeEntry = guide?.modes[mode];
  const dialCode = modeEntry?.dialCode ?? "";

  function copyDialCode() {
    void navigator.clipboard.writeText(dialCode.replace(/\*/g, "").replace(/#/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyRouting() {
    void navigator.clipboard.writeText(routingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function confirmForwarding() {
    if (!flowId) return;
    setConfirming(true);
    try {
      await fetch(`/api/smart-routing/flows/${flowId}/forwarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carrier, forwardingType: mode, confirm: true }),
      });
      onUpdated();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4" id="forwarding">
      <div>
        <h2 className="font-medium">Forward your number</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Forward <strong>{fmtPhoneDisplay(businessNumber)}</strong> to your routing number{" "}
          <strong>{fmtPhoneDisplay(routingNumber)}</strong>. Your customers keep calling the number
          they already know.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={copyRouting}>
          {copied ? <Check className="mr-1 h-3 w-3" /> : <Copy className="mr-1 h-3 w-3" />}
          Copy routing number
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Your carrier</label>
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            {CARRIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Forwarding type</label>
          <select
            className="mt-1 h-10 w-full rounded-lg border px-3 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as ForwardingMode)}
          >
            <option value="unconditional">Route every call through Smart Routing</option>
            <option value="no_answer">Only when no answer</option>
            <option value="busy">When line is busy</option>
          </select>
        </div>
      </div>

      {modeEntry ? (
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-sm font-semibold">{modeEntry.label}</p>
          <p className="mt-2 font-mono text-sm">{dialCode}</p>
          {modeEntry.notes ? (
            <p className="mt-2 text-xs text-muted-foreground">{modeEntry.notes}</p>
          ) : null}
          <Button size="sm" variant="outline" className="mt-3" onClick={copyDialCode}>
            Copy dial code
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border p-4">
        <h3 className="text-sm font-semibold">Test my forwarding</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Call your business number from another phone. We detect forwarding when a call arrives with
          your business line as the forwarding source.
        </p>
        {forwardingDetected || forwardingTest.detected ? (
          <div className="mt-3 flex items-start gap-2 text-sm text-emerald-700">
            <Check className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Forwarding detected</p>
              {forwardingTest.forwardedFrom ? (
                <p className="text-xs">
                  From {fmtPhoneDisplay(forwardingTest.forwardedFrom)}
                  {forwardingTest.callerNumber
                    ? ` · Caller ${fmtPhoneDisplay(forwardingTest.callerNumber)}`
                    : null}
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            No forwarded call detected yet. After you forward, place a test call.
          </p>
        )}
        {flowId ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            disabled={confirming}
            onClick={() => void confirmForwarding()}
          >
            I completed forwarding setup
          </Button>
        ) : null}
      </div>
    </div>
  );
}
