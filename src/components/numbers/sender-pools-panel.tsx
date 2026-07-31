"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatusChip } from "@/components/ui/status-chip";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatPhone } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type Pool = {
  id: string;
  name: string;
  description: string | null;
  phoneNumberIds: string[];
  status: string;
};

type NumberOpt = { id: string; e164: string; friendlyName: string | null };

export function SenderPoolsPanel({
  initialPools,
  numbers,
}: {
  initialPools: Pool[];
  numbers: NumberOpt[];
}) {
  const router = useRouter();
  const [pools, setPools] = useState(initialPools);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const numberLabel = useMemo(() => {
    const map = new Map(numbers.map((n) => [n.id, n.friendlyName || n.e164]));
    return map;
  }, [numbers]);

  async function createPool() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/numbers/pools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phoneNumberIds: selected }),
      });
      const json = (await res.json()) as { data?: Pool; error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to create pool");
      if (json.data) setPools((prev) => [json.data!, ...prev]);
      setName("");
      setSelected([]);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function removePool(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/numbers/pools?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setPools((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleNumber(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Create sender pool</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          Group registered numbers for high-volume distribution. All numbers must share the same
          approved A2P campaign.
        </p>
        <div className="mt-4 space-y-3">
          <div>
            <Label htmlFor="poolName">Pool name</Label>
            <Input
              id="poolName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Main outbound pool"
            />
          </div>
          <div>
            <Label>Numbers in pool</Label>
            {numbers.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">Buy or port a number first.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {numbers.map((n) => {
                  const on = selected.includes(n.id);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => toggleNumber(n.id)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {formatPhone(n.e164)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button disabled={busy} onClick={createPool}>
            <Plus className="h-4 w-4" />
            Create pool
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Pools</CardTitle>
        {pools.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No sender pools yet.</p>
        ) : (
          <Table className="mt-4">
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Numbers</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {pools.map((p) => (
                <TR key={p.id}>
                  <TD className="font-medium">{p.name}</TD>
                  <TD className="text-muted-foreground">
                    {(p.phoneNumberIds || [])
                      .map((id) => numberLabel.get(id) || id.slice(0, 8))
                      .join(", ") || "—"}
                  </TD>
                  <TD>
                    <StatusChip status={p.status} />
                  </TD>
                  <TD>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      disabled={busy}
                      onClick={() => removePool(p.id)}
                      aria-label="Delete pool"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
