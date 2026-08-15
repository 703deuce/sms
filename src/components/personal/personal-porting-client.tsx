"use client";

import { PortNumberForm } from "@/components/numbers/port-number-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PersonalNumberRow } from "@/lib/workspace/personal-data";
import { formatPhone } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

const PORT_IN_STATUSES = [
  "Started",
  "Submitted",
  "Waiting for Carrier",
  "FOC / Scheduled",
  "Completed",
  "Failed / Action Required",
];

export function PersonalPortingClient({
  numbers,
  portRequests,
}: {
  numbers: PersonalNumberRow[];
  portRequests: Array<{ id: string; phoneNumber: string; status: string; direction?: string }>;
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "out" ? "out" : "in";
  const [tab, setTab] = useState<"in" | "out">(initialTab);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button
          variant={tab === "in" ? "primary" : "outline"}
          size="sm"
          onClick={() => setTab("in")}
        >
          Port In
        </Button>
        <Button
          variant={tab === "out" ? "primary" : "outline"}
          size="sm"
          onClick={() => setTab("out")}
        >
          Port Out
        </Button>
      </div>

      {tab === "in" ? (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Bring your existing number to Transovo. We use the same carrier porting flow as business
            accounts.
          </p>
          <PortNumberForm />
          {portRequests.length > 0 ? (
            <div className="surface rounded-xl p-4">
              <h3 className="text-sm font-semibold">Your port requests</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {portRequests.map((p) => (
                  <li key={p.id}>
                    {formatPhone(p.phoneNumber)} — {p.status}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To move your number to another carrier, use the account details from your number record.
            We only show provider-backed transfer credentials.
          </p>
          {numbers.length === 0 ? (
            <EmptyState title="No numbers" description="Add a number before starting a port away." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {numbers.map((n) => (
                <li key={n.id} className="p-4 text-sm">
                  <p className="font-semibold">{formatPhone(n.number)}</p>
                  <p className="text-muted-foreground">Status: {n.serviceLabel}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Request port-out from your new carrier. Account details appear on the number detail
                    page when available from Telnyx.
                  </p>
                  <a
                    href={`/personal/numbers/${n.id}`}
                    className="mt-2 inline-block text-sm font-medium text-primary"
                  >
                    View number details
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Port-out stages: requested → pending → completed
          </p>
        </div>
      )}
    </div>
  );
}
