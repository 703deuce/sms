"use client";

import { Shield, CheckCircle2, Clock3, ArrowUpRight } from "lucide-react";
import type { BusinessRegistrationCardData } from "../types";

type Reg = BusinessRegistrationCardData;

function StatusChip({ status }: { status: "approved" | "pending" | "rejected" }) {
  if (status === "approved") {
    return (
      <span className="chip chip-success">
        <CheckCircle2 size={12} /> Approved
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="chip chip-warning">
        <Clock3 size={12} /> Under review
      </span>
    );
  }
  return <span className="chip chip-danger">Rejected</span>;
}

export default function MessagingRegistrationCard({
  registration,
  complianceReady,
  lastSynced,
}: {
  registration: Reg;
  complianceReady: boolean;
  lastSynced?: string | null;
}) {
  const lastSyncedLabel = lastSynced
    ? new Date(lastSynced).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : new Date(registration.updatedAt).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div className="side-stack">
      <section className="card">
        <div className="card-head">
          <div className="card-head-icon">
            <Shield size={16} />
          </div>
          <div>
            <h2 className="card-title">Business texting registration</h2>
            <p className="card-sub">
              Required to send appointment SMS from your business number.
            </p>
          </div>
        </div>

        <div className="status-rows">
          <div className="status-row">
            <div>
              <span className="status-label">Brand</span>
              <span className="status-value">{registration.legalBusinessName}</span>
            </div>
            <StatusChip status={registration.brandStatus} />
          </div>
          <div className="status-row">
            <div>
              <span className="status-label">Messaging use case</span>
              <span className="status-value">Appointment reminders</span>
            </div>
            <StatusChip status={registration.campaignStatus} />
          </div>
        </div>

        <div className="card-note">
          {complianceReady ? (
            <p>
              Registration is approved. Appointment confirmations and reminders can be sent
              to customers who have opted in.
            </p>
          ) : (
            <p>
              Registration is under carrier review. SMS reminders remain paused until approval.
            </p>
          )}
          <p className="card-note-meta">Last synced {lastSyncedLabel}</p>
        </div>

        <a href="/settings/messaging" className="card-link">
          Manage messaging settings <ArrowUpRight size={13} />
        </a>
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2 className="card-title">Compliance record</h2>
            <p className="card-sub">Details on file for carrier registration.</p>
          </div>
        </div>
        <dl className="def-list">
          <div className="def-row">
            <dt>Legal name</dt>
            <dd>{registration.legalBusinessName}</dd>
          </div>
          <div className="def-row">
            <dt>DBA</dt>
            <dd>{registration.dbaName || "—"}</dd>
          </div>
          <div className="def-row">
            <dt>Business type</dt>
            <dd>LLC</dd>
          </div>
          <div className="def-row">
            <dt>Industry</dt>
            <dd>Healthcare</dd>
          </div>
          <div className="def-row">
            <dt>Registration ID</dt>
            <dd>{registration.businessRegistrationId}</dd>
          </div>
          <div className="def-row">
            <dt>Country</dt>
            <dd>{registration.country}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
