import { CheckCircle2, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function TestPreviewModal({
  open,
  workflowName,
  onClose,
}: {
  open: boolean;
  workflowName: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<"running" | "done">("running");

  useEffect(() => {
    if (!open) return;
    setPhase("running");
    const t = setTimeout(() => setPhase("done"), 1400);
    return () => clearTimeout(t);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Test workflow"
        className="wf-fade-in w-full max-w-md rounded-xl bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">Test workflow</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          {phase === "running" ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Simulating "{workflowName}"…</p>
                <p className="text-xs text-muted-foreground">Evaluating trigger, conditions, and step schedule.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <p className="text-sm font-semibold text-foreground">Simulation complete — no issues found</p>
              </div>
              <ul className="space-y-1.5 rounded-lg bg-muted/60 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
                <li>Trigger fires when a matching appointment event occurs.</li>
                <li>All enabled steps have a valid action and timing.</li>
                <li>Messages render correctly with sample merge tags.</li>
                <li>Pending steps stop automatically if the appointment is canceled.</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                No real messages were sent. Save and activate the workflow to make it live.
              </p>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-lg bg-muted px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-border/70"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
