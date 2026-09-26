"use client";

import type { AppointmentReceptionistWizardState } from "@/lib/solutions/appointment-receptionist/types";
import { CallHandlingSwitcher } from "@/components/call-handling/call-handling-switcher";
import { Card } from "@/components/ui/card";
import { formatPhone } from "@/lib/utils";
import { mctbVoiceAgentStepHref } from "@/lib/mctb/voice-agent/wizard-deep-links";
import Link from "next/link";
import { useCallHandlingOptional } from "@/components/call-handling/call-handling-context";
import { useEffect, useState } from "react";

type InboundLine = {
  ingressE164?: string;
  businessLineE164?: string | null;
  forwardingStatus?: string;
};

/**
 * Product ingress surface — distinct from Amy transfer behavior (Call Handling below).
 * Does not mutate Telnyx routing; shows ownership + forwarding guidance.
 */
export function VoiceIngressSetupPanel({
  wizardState,
}: {
  wizardState: AppointmentReceptionistWizardState;
}) {
  const sharedCallHandling = useCallHandlingOptional();
  const ownership = sharedCallHandling?.state ?? null;
  const [inbound, setInbound] = useState<InboundLine | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    void (async () => {
      setLoadError("");
      try {
        const inRes = await fetch("/api/mctb/inbound-handling", { cache: "no-store" });
        const inJson = await inRes.json();
        const fwd = inJson.data?.forwarding;
        if (fwd?.ingressE164) {
          setInbound({
            ingressE164: fwd.ingressE164,
            businessLineE164: fwd.businessLineE164 ?? null,
            forwardingStatus: fwd.status,
          });
        }
      } catch {
        setLoadError("Could not load phone routing status.");
      }
    })();
  }, []);

  const businessLine =
    inbound?.businessLineE164 ||
    wizardState.phoneNumberE164 ||
    null;
  const ingress =
    ownership?.voiceIngressE164 ||
    ownership?.e164 ||
    inbound?.ingressE164 ||
    null;

  const handlerLabel =
    ownership?.effectiveHandler === "ai_receptionist"
      ? "AI Receptionist (Amy)"
      : ownership?.effectiveHandler === "mctb"
        ? "Missed Call Text Back"
        : "Not determined";

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">Your number &amp; call routing</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          This is <strong>who receives the phone call</strong> when your carrier forwards unanswered
          calls to Transovo. It is separate from how Amy transfers a caller to your team after
          answering.
        </p>
      </div>

      {loadError ? <p className="text-xs text-destructive">{loadError}</p> : null}

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Your business line</dt>
          <dd className="font-medium">
            {businessLine ? formatPhone(businessLine) : "Not set in agent setup"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Transovo forwarding destination</dt>
          <dd className="font-medium">{ingress ? formatPhone(ingress) : "Not provisioned yet"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Active product on this line</dt>
          <dd className="font-medium">{handlerLabel}</dd>
        </div>
        {inbound?.forwardingStatus ? (
          <div>
            <dt className="text-muted-foreground">Forwarding setup status</dt>
            <dd className="font-medium capitalize">{inbound.forwardingStatus.replace(/_/g, " ")}</dd>
          </div>
        ) : null}
      </dl>

      <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Keep your existing number</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>In your carrier account, forward unanswered calls to the Transovo destination above.</li>
          <li>Choose whether Amy (AI Receptionist) or Missed Call Text Back handles that line.</li>
          <li>Configure Amy&apos;s transfer behavior in the sections below.</li>
        </ol>
        <p className="mt-2">
          Carrier forwarding is performed on your phone account — Transovo does not change it from
          this screen.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <CallHandlingSwitcher variant="card" />
        <Link
          href={mctbVoiceAgentStepHref("phone")}
          className="text-sm font-medium text-primary underline"
        >
          Phone &amp; recording in AI agent setup
        </Link>
        <Link href="/mctb/setup/phone" className="text-sm text-muted-foreground underline">
          MCTB forwarding instructions
        </Link>
        <Link href="/voice/inbound-routing" className="text-sm text-muted-foreground underline">
          Advanced routing rules
        </Link>
      </div>
    </Card>
  );
}
