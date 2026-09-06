import { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "18px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Brand />
      </header>
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "8px 16px 56px",
        }}
      >
        {children}
      </main>
      <footer
        style={{
          padding: "18px 24px 26px",
          textAlign: "center",
          fontSize: 12,
          color: "var(--text-muted)",
        }}
      >
        Powered by <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>Transovo</span>
      </footer>
    </div>
  );
}

export function Brand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }} aria-label="Transovo">
      <span
        aria-hidden="true"
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: "linear-gradient(135deg, var(--accent) 0%, #7c6cf0 100%)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: "-0.02em",
        }}
      >
        T
      </span>
      <span
        style={{
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: "var(--text-primary)",
        }}
      >
        Transovo
      </span>
    </span>
  );
}
