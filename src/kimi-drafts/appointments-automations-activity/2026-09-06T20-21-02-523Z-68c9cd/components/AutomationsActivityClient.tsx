"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { WorkflowLogsPanel } from "./WorkflowLogsPanel";
import { UnknownRepliesPanel } from "./UnknownRepliesPanel";
import { LogDetailDrawer } from "./LogDetailDrawer";
import { unknownReplies as mockReplies, workflowLogs as mockLogs } from "../mock-data";
import type { UnknownReply, WorkflowLog } from "../mock-data";

export function AutomationsActivityClient() {
  const [logs, setLogs] = useState<WorkflowLog[]>([]);
  const [replies, setReplies] = useState<UnknownReply[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [loadingReplies, setLoadingReplies] = useState(true);
  const [logsError, setLogsError] = useState(false);
  const [repliesError, setRepliesError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<WorkflowLog | null>(null);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    setLogsError(false);
    try {
      const res = await fetch("/api/appointments/workflows/logs?limit=100");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLogs(json.data?.length ? json.data : mockLogs);
    } catch {
      setLogs(mockLogs);
    }
    setLoadingLogs(false);
  }, []);

  const loadReplies = useCallback(async () => {
    setLoadingReplies(true);
    setRepliesError(false);
    try {
      const res = await fetch("/api/appointments/workflows/unknown-replies");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setReplies(json.data ?? mockReplies);
    } catch {
      setReplies(mockReplies);
    }
    setLoadingReplies(false);
  }, []);

  useEffect(() => {
    loadLogs();
    loadReplies();
  }, [loadLogs, loadReplies]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function clearReply(appointmentId: string) {
    try {
      await fetch("/api/appointments/workflows/unknown-replies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, action: "clear" }),
      });
    } catch {
      /* sandbox: dismiss locally */
    }
    setReplies((prev) => prev.filter((i) => i.appointmentId !== appointmentId));
    setToast("Reply dismissed.");
  }

  function refreshAll() {
    loadLogs();
    loadReplies();
  }

  return (
    <div className="tv-page">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        {/* Page header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium" style={{ color: "var(--tv-text-muted)" }}>
              Automations
            </p>
            <h1 className="mt-0.5 text-[24px] font-semibold tracking-tight" style={{ color: "var(--tv-text)" }}>
              Activity
            </h1>
            <p className="mt-1 text-[13.5px]" style={{ color: "var(--tv-text-secondary)" }}>
              Workflow execution history and customer replies that need your attention.
            </p>
          </div>
          <button
            type="button"
            className="tv-btn tv-btn-outline"
            onClick={refreshAll}
            disabled={loadingLogs || loadingReplies}
          >
            <RefreshCw size={14} className={loadingLogs || loadingReplies ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Attention banner for unknown replies */}
        {!loadingReplies && replies.length > 0 && (
          <div
            className="mt-6 flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ background: "var(--tv-warning-bg)", borderColor: "#fedf89" }}
            role="status"
          >
            <span className="tv-chip tv-chip-warning">
              <span className="dot" /> Needs attention
            </span>
            <p className="text-[13px] font-medium" style={{ color: "var(--tv-warning)" }}>
              {replies.length} customer {replies.length === 1 ? "reply" : "replies"} didn't match a
              confirm, cancel, or reschedule keyword — review below.
            </p>
          </div>
        )}

        <div className="mt-6 space-y-6">
          <WorkflowLogsPanel
            logs={logs}
            loading={loadingLogs}
            error={logsError}
            onRetry={loadLogs}
            onSelectLog={setSelectedLog}
          />
          <UnknownRepliesPanel
            items={replies}
            loading={loadingReplies}
            error={repliesError}
            onRetry={loadReplies}
            onDismiss={clearReply}
          />
        </div>
      </div>

      {toast && (
        <div className="tv-toast" role="status">
          {toast}
        </div>
      )}

      <LogDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
