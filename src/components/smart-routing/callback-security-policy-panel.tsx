"use client";

import { cn } from "@/lib/utils";
import { srCard } from "@/components/smart-routing/shared";
import { isDomesticCallbackDestination } from "@/lib/smart-routing/callback-destination-policy";

export function CallbackSecurityPolicyPanel() {
  const policies = [
    "Domestic US/Canada destinations only",
    "Cannot call routing or callback access numbers",
    "Premium-rate numbers blocked",
    "Outbound requires verified business caller ID",
  ];

  return (
    <div className={cn(srCard, "p-5")}>
      <h2 className="text-sm font-semibold text-[#111827]">Security policy</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Business callbacks enforce these rules server-side on every dial attempt.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-[#374151]">
        {policies.map((p) => (
          <li key={p} className="flex items-start gap-2">
            <span className="text-emerald-600">✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Test: +17035551234 is{" "}
        {isDomesticCallbackDestination("+17035551234") ? "allowed" : "blocked"} domestically.
      </p>
    </div>
  );
}
