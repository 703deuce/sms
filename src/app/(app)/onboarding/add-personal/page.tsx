"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AddPersonalWorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_personal" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create Personal workspace");
      router.push("/personal");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md surface rounded-xl p-6">
      <h1 className="text-lg font-semibold">Add Personal workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Keep, forward, or park personal phone numbers without business SMS or AI agents.
      </p>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      <Button className="mt-4" onClick={create} disabled={loading}>
        {loading ? "Creating…" : "Create Personal workspace"}
      </Button>
    </div>
  );
}
