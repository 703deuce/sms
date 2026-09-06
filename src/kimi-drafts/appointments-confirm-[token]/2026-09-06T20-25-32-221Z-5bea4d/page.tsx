"use client";

import { useState } from "react";
import { PublicActionClient } from "./components/public-action-client";
import type { ActionKind } from "./mock-data";
import "./reference.css";

type PreviewScenario = "valid" | "invalid" | "already-confirmed" | "already-canceled" | "past";

export default function ReferencePage() {
  const [kind, setKind] = useState<ActionKind>("confirm");
  const [scenario, setScenario] = useState<PreviewScenario>("valid");

  const token =
    scenario === "invalid"
      ? "invalid"
      : scenario === "already-confirmed"
        ? "demo-already-confirmed"
        : scenario === "already-canceled"
          ? "demo-already-canceled"
          : scenario === "past"
            ? "demo-past"
            : "demo-token-abc123";

  return (
    <div className="pub-root">
      {/* Sandbox view switcher (dev-only chrome, not part of the public surface) */}
      <div className="sandbox-switcher-wrap">
        <div className="sandbox-switcher" role="tablist" aria-label="Preview action kind">
          {(["confirm", "cancel", "reschedule"] as ActionKind[]).map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={kind === k}
              className={`sandbox-tab${kind === k ? " is-active" : ""}`}
              onClick={() => setKind(k)}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <div className="sandbox-switcher" role="tablist" aria-label="Preview link state">
          {(
            [
              ["valid", "Valid"],
              ["already-confirmed", "Already confirmed"],
              ["already-canceled", "Already canceled"],
              ["past", "Past"],
              ["invalid", "Invalid link"],
            ] as Array<[PreviewScenario, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              role="tab"
              aria-selected={scenario === value}
              className={`sandbox-tab${scenario === value ? " is-active" : ""}`}
              onClick={() => setScenario(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <PublicActionClient key={`${kind}:${scenario}`} kind={kind} token={token} />
    </div>
  );
}
