"use client";

import { useState } from "react";
import { BillingSettingsPanel } from "./components/BillingSettingsPanel";
import "./reference.css";

export default function ReferencePage() {
  const [state, setState] = useState<"normal" | "loading" | "empty" | "error" | "readonly">("normal");

  return (
    <div className="tv-app">
      {/* Dev state switcher (sandbox only) */}
      <div className="tv-devbar">
        <span>Preview state:</span>
        {(["normal", "loading", "empty", "error", "readonly"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={state === s ? "tv-devbtn active" : "tv-devbtn"}
          >
            {s}
          </button>
        ))}
      </div>
      <BillingSettingsPanel mode={state} />
    </div>
  );
}
