"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BlockedContactUnblockButton({ contactId }: { contactId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function unblock() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBSCRIBED" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error || "Could not unblock contact");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unblock contact");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="ghost" size="sm" onClick={() => void unblock()} disabled={busy}>
        {busy ? "Unblocking…" : "Unblock"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
