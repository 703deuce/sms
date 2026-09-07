"use client";

import { CheckCircle2 } from "lucide-react";
import type { MessagingRegistrationView } from "../types";

type Props = { registration: MessagingRegistrationView };

export function RegistrationCard({ registration: reg }: Props) {
  return (
    <section className="ref-card" aria-labelledby="reg-title">
      <div className="ref-card-head">
        <div>
          <h2 className="ref-card-title" id="reg-title">Business texting registration</h2>
          <p className="ref-card-sub">
            Sender identity registered with U.S. carriers for application-to-person messaging.
            Registration covers the sender — recipient consent is still required for every contact.
          </p>
        </div>
        <span className="ref-chip green">
          <CheckCircle2 size={12} /> Approved
        </span>
      </div>

      <div className="ref-meta">
        <div className="ref-meta-item">
          <div className="ref-meta-k">Brand</div>
          <div className="ref-meta-v">{reg.brandName}</div>
        </div>
        <div className="ref-meta-item">
          <div className="ref-meta-k">Use case</div>
          <div className="ref-meta-v">{reg.useCase}</div>
        </div>
        <div className="ref-meta-item">
          <div className="ref-meta-k">Message volume</div>
          <div className="ref-meta-v">{reg.messageVolume}</div>
        </div>
        <div className="ref-meta-item">
          <div className="ref-meta-k">Vertical</div>
          <div className="ref-meta-v">{reg.vertical}</div>
        </div>
        <div className="ref-meta-item">
          <div className="ref-meta-k">Submitted</div>
          <div className="ref-meta-v">{reg.submittedAt}</div>
        </div>
        <div className="ref-meta-item">
          <div className="ref-meta-k">Approved</div>
          <div className="ref-meta-v">{reg.approvedAt}</div>
        </div>
      </div>

      <hr className="ref-divider" />

      <p className="ref-section-label">Registered sample messages</p>
      {reg.sampleMessages.map((m, i) => (
        <div key={i} className="ref-sample">{m}</div>
      ))}

      <p className="ref-hint" style={{ marginTop: 12 }}>
        Outbound appointment messages must stay consistent with this registered use case.
        Opt-in method on file: {reg.optInDescription}
      </p>
    </section>
  );
}
