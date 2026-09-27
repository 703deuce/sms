"use client";

import { useEffect, useState } from "react";
import { ConnectableProvidersOpus } from "@/newui-transplant/connected/integrations/connectable-providers-opus";
import { Panel } from "@/newui-transplant/components/app/kit";
import { ButtonLink } from "@/newui-transplant/components/app/button-link";

export function NativeIntegrationsOpus() {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("connected_error");
    const connected = params.get("connected");
    if (err) setMessage({ text: err, error: true });
    if (connected) setMessage({ text: `Connected ${connected}` });
  }, []);

  return (
    <div className="space-y-6">
      {message ? (
        <p className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`} role="status">
          {message.text}
        </p>
      ) : null}

      <Panel title="Connect apps" description="OAuth and credential-based native integrations.">
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/integrations" variant="outline">Integrations home</ButtonLink>
          <ButtonLink href="/integrations/crm" variant="outline">CRM settings</ButtonLink>
          <ButtonLink href="/integrations/native/leads" variant="outline">Lead inbox</ButtonLink>
          <ButtonLink href="/integrations/native/appointments" variant="outline">Appointments</ButtonLink>
          <ButtonLink href="/integrations/native/tasks" variant="outline">Tasks</ButtonLink>
          <ButtonLink href="/integrations/native/orders" variant="outline">Orders</ButtonLink>
        </div>
      </Panel>

      <ConnectableProvidersOpus />
    </div>
  );
}
