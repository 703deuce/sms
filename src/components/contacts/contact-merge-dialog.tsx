"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type MergePreview = {
  sourceContactId: string;
  targetContactId: string;
  conflicts: Record<string, { source: string | null; target: string | null }>;
  appointmentCounts: { source: number; target: number };
  packageCounts?: { source: number; target: number };
  membershipCounts?: { source: number; target: number };
  paymentCounts?: { source: number; target: number };
};

type Props = {
  open: boolean;
  onClose: () => void;
  primaryContactId?: string;
  primaryContactLabel?: string;
};

export function ContactMergeDialog({
  open,
  onClose,
  primaryContactId,
  primaryContactLabel,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<"select" | "review" | "confirm">("select");
  const [duplicateQuery, setDuplicateQuery] = useState("");
  const [duplicateContactId, setDuplicateContactId] = useState("");
  const [targetContactId, setTargetContactId] = useState(primaryContactId || "");
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [chosenValues, setChosenValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("select");
    setDuplicateQuery("");
    setDuplicateContactId("");
    setTargetContactId(primaryContactId || "");
    setPreview(null);
    setChosenValues({});
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function runPreview() {
    const source = duplicateContactId.trim();
    const target = targetContactId.trim();
    if (!source || !target || source === target) {
      setError("Choose two different contacts to merge.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/contact-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceContactId: source, targetContactId: target }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Preview failed");
      const data = json.data as MergePreview;
      setPreview(data);
      const defaults: Record<string, string> = {};
      for (const [field, vals] of Object.entries(data.conflicts)) {
        defaults[field] = vals.target || vals.source || "";
      }
      setChosenValues(defaults);
      setStep("review");
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function runMerge() {
    if (!preview) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/contact-merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "merge",
          sourceContactId: preview.sourceContactId,
          targetContactId: preview.targetContactId,
          chosenValues,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Merge failed");
      handleClose();
      router.push(`/contacts/${preview.targetContactId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Merge failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="contact-merge-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close merge dialog" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl">
        <header className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h2 id="contact-merge-title" className="text-base font-semibold text-foreground">
              Merge duplicate contact
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Combine two records. Appointments, packages, and memberships move to the surviving contact.
            </p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          {step === "select" ? (
            <>
              {primaryContactLabel ? (
                <p className="text-sm text-muted-foreground">
                  Primary record: <span className="font-medium text-foreground">{primaryContactLabel}</span>
                </p>
              ) : null}
              <label className="flex flex-col gap-1 text-sm">
                <span>Surviving contact ID</span>
                <input
                  className="rounded border px-3 py-2 font-mono text-xs"
                  value={targetContactId}
                  onChange={(e) => setTargetContactId(e.target.value)}
                  placeholder="Contact to keep"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Duplicate contact ID (will be removed)</span>
                <input
                  className="rounded border px-3 py-2 font-mono text-xs"
                  value={duplicateContactId}
                  onChange={(e) => setDuplicateContactId(e.target.value)}
                  placeholder="Paste duplicate contact ID"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Search hint (optional)</span>
                <input
                  className="rounded border px-3 py-2 text-sm"
                  value={duplicateQuery}
                  onChange={(e) => setDuplicateQuery(e.target.value)}
                  placeholder="Name, email, or phone to find duplicate in Contacts"
                />
              </label>
            </>
          ) : null}

          {step === "review" && preview ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Appointments: {preview.appointmentCounts.source} from duplicate → target has {preview.appointmentCounts.target}
              </p>
              {Object.keys(preview.conflicts).length > 0 ? (
                <div className="space-y-3">
                  <p className="font-semibold">Resolve conflicting fields</p>
                  {Object.entries(preview.conflicts).map(([field, vals]) => (
                    <fieldset key={field} className="space-y-1">
                      <legend className="capitalize text-xs font-medium text-muted-foreground">{field}</legend>
                      {vals.source ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={field}
                            checked={chosenValues[field] === vals.source}
                            onChange={() => setChosenValues((prev) => ({ ...prev, [field]: vals.source! }))}
                          />
                          {vals.source}
                        </label>
                      ) : null}
                      {vals.target ? (
                        <label className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={field}
                            checked={chosenValues[field] === vals.target}
                            onChange={() => setChosenValues((prev) => ({ ...prev, [field]: vals.target! }))}
                          />
                          {vals.target}
                        </label>
                      ) : null}
                    </fieldset>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">No field conflicts — safe to merge.</p>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t px-5 py-4">
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          {step === "select" ? (
            <Button onClick={() => void runPreview()} disabled={loading}>
              {loading ? "Working…" : "Compare records"}
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => void runMerge()} disabled={loading}>
              {loading ? "Merging…" : "Confirm merge"}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
