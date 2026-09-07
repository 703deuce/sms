"use client";

import { X, MessageSquare, Mail, ExternalLink } from "lucide-react";
import type { WorkflowLog } from "../mock-data";

type Props = {
  log: WorkflowLog | null;
  onClose: () => void;
};

function formatFull(iso: string) {
  return new Date(iso).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LogDetailDrawer({ log, onClose }: Props) {
  if (!log) return null;

  return (
    <>
      <button
        type="button"
        className="tv-drawer-backdrop"
        aria-label="Close details"
        onClick={onClose}
      />
      <aside className="tv-drawer" role="dialog" aria-labelledby="log-detail-title">
        <div className="tv-drawer-head">
          <div>
            <h2 id="log-detail-title" className="text-[15px] font-semibold tracking-tight">
              Step details
            </h2>
            <p className="text-[12.5px]" style={{ color: "var(--tv-text-muted)" }}>
              {log.workflowName} · {log.stepName}
            </p>
          </div>
          <button type="button" className="tv-btn tv-btn-ghost tv-btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="tv-drawer-body">
          <dl className="tv-detail-list">
            <div>
              <dt>Status</dt>
              <dd className="capitalize">{log.status}</dd>
            </div>
            <div>
              <dt>Channel</dt>
              <dd className="inline-flex items-center gap-1.5">
                {log.channel === "sms" ? <MessageSquare size={13} /> : log.channel === "email" ? <Mail size={13} /> : null}
                {log.channel ? (log.channel === "sms" ? "SMS" : "Email") : "—"}
              </dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd>{log.contactName || "—"}</dd>
            </div>
            <div>
              <dt>Appointment</dt>
              <dd>
                {log.appointmentId ? (
                  <a href={`/appointments/${log.appointmentId}`} className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--tv-accent)" }}>
                    View appointment <ExternalLink size={12} />
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Executed</dt>
              <dd>{formatFull(log.createdAt)}</dd>
            </div>
            {log.scheduledFor ? (
              <div>
                <dt>Scheduled for</dt>
                <dd>{formatFull(log.scheduledFor)}</dd>
              </div>
            ) : null}
          </dl>

          {log.messagePreview ? (
            <div className="tv-detail-block">
              <p className="tv-detail-label">Message preview</p>
              <pre className="tv-detail-pre">{log.messagePreview}</pre>
            </div>
          ) : null}

          {log.error ? (
            <div className="tv-detail-block tv-detail-error" role="alert">
              <p className="tv-detail-label">Failure reason</p>
              <p>{log.error}</p>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
