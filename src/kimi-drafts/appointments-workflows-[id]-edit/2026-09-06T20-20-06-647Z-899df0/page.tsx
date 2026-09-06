"use client";

import { useState } from "react";
import { WorkflowEditor } from "./components/WorkflowEditor";
import { INITIAL_WORKFLOW } from "./mock-data";
import "./reference.css";

export default function ReferencePage() {
  const [scenario, setScenario] = useState<"edit" | "loading" | "error">("edit");

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Scenario switcher (sandbox only) */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          zIndex: 60,
          display: "flex",
          gap: 6,
          padding: 6,
          borderRadius: 10,
        }}
        className="surface"
      >
        {(["edit", "loading", "error"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScenario(s)}
            style={{
              height: 28,
              padding: "0 10px",
              borderRadius: 7,
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              background: scenario === s ? "var(--primary)" : "transparent",
              color: scenario === s ? "#fff" : "var(--muted-foreground)",
            }}
          >
            {s === "edit" ? "Normal" : s === "loading" ? "Loading" : "Error"}
          </button>
        ))}
      </div>

      {scenario === "loading" ? (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }} aria-busy="true" aria-label="Loading workflow">
          <div className="skeleton" style={{ height: 20, width: 160, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 32, width: 320, marginBottom: 28 }} />
          <div className="skeleton" style={{ height: 180, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 140, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 140 }} />
        </div>
      ) : scenario === "error" ? (
        <div style={{ maxWidth: 1080, margin: "0 auto", padding: "32px 24px" }}>
          <div className="surface" style={{ borderRadius: 12, padding: 32, textAlign: "center", marginTop: 80 }} role="alert">
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Workflow couldn't be loaded</div>
            <p className="text-muted-foreground" style={{ fontSize: 13, margin: "0 0 16px" }}>
              We couldn't load this workflow. Check your connection and try again.
            </p>
            <button
              onClick={() => setScenario("edit")}
              style={{
                height: 34,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: "var(--primary)",
                color: "#fff",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <WorkflowEditor initial={INITIAL_WORKFLOW} mode="edit" />
      )}
    </div>
  );
}
