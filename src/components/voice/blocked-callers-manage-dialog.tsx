"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";

type BlockedRow = {
  id: string;
  callerE164: string;
  displayName: string | null;
  createdAt: string;
};

export function BlockedCallersManageDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BlockedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newNumber, setNewNumber] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/voice/blocked-callers");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load blocked callers.");
      setRows(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load blocked callers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function unblock(callerE164: string) {
    setError(null);
    const res = await fetch(
      `/api/voice/blocked-callers?callerE164=${encodeURIComponent(callerE164)}`,
      { method: "DELETE" },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not unblock caller.");
      return;
    }
    await refresh();
  }

  async function addBlock() {
    const phone = newNumber.trim();
    if (!phone) return;
    setError(null);
    const res = await fetch("/api/voice/blocked-callers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callerE164: phone }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error || "Could not block caller.");
      return;
    }
    setNewNumber("");
    await refresh();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="blocked-callers-dialog-title"
    >
      <div className="max-h-[85vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="blocked-callers-dialog-title" className="text-lg font-semibold">
              Blocked callers
            </h2>
            <p className="text-sm text-muted-foreground">
              Numbers blocked from reaching your AI receptionist.
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {error ? (
          <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="blocked-caller-add">Phone number</Label>
            <Input
              id="blocked-caller-add"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              placeholder="+1…"
              autoComplete="tel"
            />
          </div>
          <Button type="button" onClick={() => void addBlock()} disabled={!newNumber.trim()}>
            Block number
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH scope="col">Caller</TH>
                <TH scope="col">Blocked</TH>
                <TH scope="col">
                  <span className="sr-only">Actions</span>
                </TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <div className="font-medium">{r.callerE164}</div>
                    {r.displayName ? (
                      <div className="text-xs text-muted-foreground">{r.displayName}</div>
                    ) : null}
                  </TD>
                  <TD className="text-sm text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()}
                  </TD>
                  <TD>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void unblock(r.callerE164)}
                    >
                      Unblock
                    </Button>
                  </TD>
                </TR>
              ))}
              {!rows.length ? (
                <TR>
                  <TD colSpan={3} className="text-muted-foreground">
                    No blocked callers yet.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
