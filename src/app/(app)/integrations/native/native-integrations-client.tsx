"use client";

import { PageHeader } from "@/components/ui/page-header";
import { ConnectableProvidersGrid } from "@/components/integrations/connectable-providers-grid";
import Link from "next/link";
import { useEffect, useState } from "react";

export function NativeIntegrationsClient() {
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("connected_error");
    const connected = params.get("connected");
    if (err) setMessage({ text: err, error: true });
    if (connected) setMessage({ text: `Connected ${connected}` });
  }, []);

  return (
    <div>
      <PageHeader
        title="Connect apps"
        description="All 12 connectable providers (Mailchimp deferred). OAuth apps open authorize; credential apps open the setup form."
      />

      {message ? (
        <p className={`mb-4 text-sm ${message.error ? "text-red-600" : "text-emerald-700"}`}>
          {message.text}
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3 text-sm">
        <Link href="/integrations" className="underline">
          ← Integrations home
        </Link>
        <Link href="/integrations/crm" className="underline">
          CRM settings
        </Link>
        <Link href="/integrations/native/leads" className="underline">
          Lead inbox
        </Link>
        <Link href="/integrations/native/appointments" className="underline">
          Appointments
        </Link>
        <Link href="/integrations/native/tasks" className="underline">
          Tasks
        </Link>
        <Link href="/integrations/native/orders" className="underline">
          Orders
        </Link>
      </div>

      <ConnectableProvidersGrid />
    </div>
  );
}
