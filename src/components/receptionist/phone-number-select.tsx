"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export type PhoneNumberOption = {
  id: string;
  e164: string;
  friendlyName: string | null;
  aiOwner?: { id: string; name: string; status: string } | null;
};

export function PhoneNumberSelect({
  value,
  onChange,
  className,
  allowEmpty = true,
  emptyLabel = "No number assigned",
}: {
  value: string | null;
  onChange: (phoneNumberId: string | null) => void;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  const [options, setOptions] = useState<PhoneNumberOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/phone/numbers")
      .then((r) => r.json())
      .then((j) => setOptions(j.data || []))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <select
      className={cn(
        "h-10 w-full max-w-md rounded-lg border border-border bg-card px-3 text-sm",
        className,
      )}
      value={value || ""}
      disabled={loading}
      onChange={(e) => onChange(e.target.value || null)}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {options.map((pn) => (
        <option key={pn.id} value={pn.id}>
          {pn.e164}
          {pn.friendlyName ? ` · ${pn.friendlyName}` : ""}
          {pn.aiOwner?.id && pn.aiOwner.id !== value
            ? ` (used by ${pn.aiOwner.name || "another agent"})`
            : ""}
        </option>
      ))}
    </select>
  );
}
