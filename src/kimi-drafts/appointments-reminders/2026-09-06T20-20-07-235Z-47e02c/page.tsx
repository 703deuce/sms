"use client";

import { useEffect, useState } from "react";
import "./reference.css";
import ReminderSettings from "./components/ReminderSettings";
import { RemindersLoading, RemindersError, RemindersEmpty } from "./components/StatusViews";
import { REMINDERS } from "./mock-data";

type ViewState = "loading" | "error" | "empty" | "normal";

export default function ReferencePage() {
  const [state, setState] = useState<ViewState>("loading");
  const [previewDegraded, setPreviewDegraded] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  const load = () => {
    setState("loading");
    setPreviewDegraded(false);
    const t = window.setTimeout(() => {
      // Sandbox simulates a successful settings fetch with configured reminders.
      // Hash flags allow previewing alternate states:
      //   #degraded → settings loaded but customer previews failed to refresh
      //   #readonly → view-only permission state
      if (typeof window !== "undefined") {
        setPreviewDegraded(window.location.hash === "#degraded");
        setReadOnly(window.location.hash === "#readonly");
      }
      setState("normal");
    }, 700);
    return () => window.clearTimeout(t);
  };

  useEffect(() => {
    const cleanup = load();
    return cleanup;
  }, []);

  if (state === "loading") return <RemindersLoading />;
  if (state === "error") return <RemindersError onRetry={load} />;
  if (state === "empty") return <RemindersEmpty onEnable={() => setState("normal")} />;

  return (
    <ReminderSettings
      reminders={REMINDERS}
      previewDegraded={previewDegraded}
      readOnly={readOnly}
    />
  );
}
