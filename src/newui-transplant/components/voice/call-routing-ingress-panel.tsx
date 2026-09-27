"use client";

import { useEffect, useState } from "react";
import { Panel, Rows, TextLink } from "@/newui-transplant/components/app/kit";
import { CallHandlingSwitcher } from "@/components/call-handling/call-handling-switcher";
import { formatPhone } from "@/lib/utils";
import { mctbVoiceAgentStepHref } from "@/lib/mctb/voice-agent/wizard-deep-links";

type InboundLine = {
  ingressE164?: string;
  businessLineE164?: string | null;
  forwardingStatus?: string;
};

export function OpusCallRoutingIngressPanel() {
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

  const businessLine = inbound?.businessLineE164;
  const ingress = inbound?.ingressE164;

  const rows = [
    {
      label: "Your business line",
      value: businessLine ? formatPhone(businessLine) : "Not set",
    },
    {
      label: "Transovo forwarding destination",
      value: ingress ? formatPhone(ingress) : "Not provisioned yet",
    },
    {
      label: "Forwarding setup status",
      value: inbound?.forwardingStatus
        ? inbound.forwardingStatus.replace(/_/g, " ")
        : "Unknown",
    },
  ];

  return (
    <Panel
      title="Your number & call routing"
      description="Who receives forwarded inbound calls is separate from how Amy transfers callers after answering."
      className="mt-8"
    >
      {loadError ? <p className="mb-3 text-xs text-destructive">{loadError}</p> : null}
      <Rows items={rows} />
      <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
        <li>In your carrier account, forward unanswered calls to the Transovo destination above.</li>
        <li>Choose whether AI Receptionist or Missed Call Text Back handles that line.</li>
        <li>Configure Amy&apos;s transfer behavior in the sections above.</li>
      </ol>
      <p className="mt-2 text-xs text-muted-foreground">
        Carrier forwarding is performed on your phone account — Transovo does not change it from this
        screen.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <CallHandlingSwitcher variant="card" />
        <TextLink href={mctbVoiceAgentStepHref("phone")}>Phone &amp; recording in AI agent setup</TextLink>
        <TextLink href="/mctb/setup/phone">MCTB forwarding instructions</TextLink>
        <TextLink href="/voice/call-handling">Advanced routing rules</TextLink>
      </div>
    </Panel>
  );
}
