import { AlertTriangle } from "lucide-react";

export function SetupLoading() {
  return (
    <div className="setup-page" style={{ background: "#f7f7fa", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "32px 32px 56px" }}>
        <div className="setup-skel" style={{ height: 30, width: 200, marginBottom: 8 }} />
        <div className="setup-skel" style={{ height: 16, width: 340, marginBottom: 28 }} />
        <div className="setup-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 24, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="setup-skel" style={{ height: 128, borderRadius: 12 }} />
            <div className="setup-skel" style={{ height: 420, borderRadius: 12 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="setup-skel" style={{ height: 280, borderRadius: 12 }} />
            <div className="setup-skel" style={{ height: 160, borderRadius: 12 }} />
            <div className="setup-skel" style={{ height: 200, borderRadius: 12 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SetupError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="setup-page"
      style={{ background: "#f7f7fa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          maxWidth: 420,
          width: "100%",
          textAlign: "center",
          borderRadius: 12,
          border: "1px dashed var(--setup-border)",
          background: "#fff",
          padding: "48px 32px",
        }}
        role="alert"
      >
        <div
          style={{
            margin: "0 auto 14px",
            display: "flex",
            height: 44,
            width: 44,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 12,
            background: "var(--setup-accent-soft)",
            color: "var(--setup-accent)",
          }}
        >
          <AlertTriangle size={20} strokeWidth={2} />
        </div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--setup-text)", margin: 0 }}>
          We couldn&apos;t load setup progress
        </h3>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--setup-muted)", lineHeight: 1.5 }}>
          Something went wrong while checking your booking setup checklist. Your data is safe — try loading it again.
        </p>
        <button type="button" className="setup-btn setup-btn-primary" style={{ marginTop: 20 }} onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}

export type SetupViewState = "loading" | "partial" | "empty" | "complete" | "readonly" | "error";

export function StateSwitcher({
  state,
  onChange,
}: {
  state: SetupViewState;
  onChange: (s: SetupViewState) => void;
}) {
  const options: Array<{ id: SetupViewState; label: string }> = [
    { id: "partial", label: "In progress" },
    { id: "empty", label: "First use" },
    { id: "complete", label: "Complete" },
    { id: "readonly", label: "Read-only" },
    { id: "loading", label: "Loading" },
    { id: "error", label: "Error" },
  ];
  return (
    <div className="setup-state-switcher" role="tablist" aria-label="Preview state">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={state === o.id}
          className={state === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
