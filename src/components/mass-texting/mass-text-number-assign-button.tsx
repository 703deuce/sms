"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export function MassTextNumberAssignButton({
  phoneNumberId,
  isAssigned,
}: {
  phoneNumberId: string;
  isAssigned: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [assigned, setAssigned] = useState(isAssigned);
  const [error, setError] = useState<string | null>(null);

  async function assign() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/mass-texting/numbers/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not assign number");
      setAssigned(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign number");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size="sm"
        variant={assigned ? "outline" : "primary"}
        disabled={loading || assigned}
        onClick={assign}
      >
        {assigned ? "Mass Texting sender" : loading ? "Assigning…" : "Use for Mass Texting"}
      </Button>
      {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
      <p className="text-[12px] text-muted-foreground">
        Mass Texting sends use this number and marketing A2P registration — separate from MCTB.
      </p>
    </div>
  );
}
