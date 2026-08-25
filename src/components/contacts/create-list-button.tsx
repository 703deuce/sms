"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateListButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contacts/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to create list");
      }
      setName("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create list");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ListPlus className="h-4 w-4" />
        Create list
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="min-w-[160px]">
        <Input
          placeholder="List name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="List name"
        />
      </div>
      <div className="min-w-[200px]">
        <Input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="List description"
        />
      </div>
      <Button onClick={handleCreate} disabled={loading || !name.trim()}>
        {loading ? "Creating…" : "Save"}
      </Button>
      <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
        Cancel
      </Button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
