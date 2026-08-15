"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function AddBusinessWorkspacePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          type: "BUSINESS",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create business workspace");
      router.push("/outcomes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md surface rounded-xl p-6">
      <h1 className="text-lg font-semibold">Add Business workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        AI receptionist, business phone, Smart Routing, SMS, and automations.
      </p>
      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
        <div>
          <Label htmlFor="name">Business name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="ABC Roofing"
          />
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading ? "Creating…" : "Create Business workspace"}
        </Button>
      </form>
    </div>
  );
}
