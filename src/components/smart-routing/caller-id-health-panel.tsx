"use client";

import { cn } from "@/lib/utils";
import { srCard } from "@/components/smart-routing/shared";
import { fmtPhoneDisplay } from "@/lib/smart-routing/display";

type CallerIdentity = {
  e164: string;
  label: string;
  verified: boolean;
  callerNameStatus?: "registered" | "pending" | "not_configured";
};

export function CallerIdHealthPanel({
  identities,
  status,
}: {
  identities: CallerIdentity[];
  status: string;
}) {
  return (
    <div className={cn(srCard, "p-5")}>
      <h2 className="text-sm font-semibold text-[#111827]">Caller ID health</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Verified identities and CNAM registration status for outbound business calls.
      </p>
      <div className="mt-3 space-y-2">
        {identities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No caller identities configured.</p>
        ) : (
          identities.map((id) => (
            <div
              key={id.e164}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e5e7eb] px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{fmtPhoneDisplay(id.e164)}</p>
                <p className="text-xs text-muted-foreground">{id.label}</p>
              </div>
              <div className="text-right text-xs">
                <p className={id.verified ? "text-emerald-700 font-semibold" : "text-amber-700"}>
                  {id.verified ? "Verified" : "Not verified"}
                </p>
                <p className="text-muted-foreground">
                  CNAM: {id.callerNameStatus === "registered" ? "Registered" : "Not configured"}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Workspace verification status: <strong>{status}</strong>
      </p>
    </div>
  );
}
