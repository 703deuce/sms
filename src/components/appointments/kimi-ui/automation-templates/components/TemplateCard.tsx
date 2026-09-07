"use client";

import {
  BellRing,
  CalendarCheck2,
  Clock,
  CreditCard,
  Heart,
  MessageSquareHeart,
  RefreshCcw,
  Sparkles,
  Star,
  UserX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Badge, Chip } from "./ui";
import { triggerLabel, type WorkflowTemplate } from "../types";

const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  standard_reminders: BellRing,
  confirmation_required: CalendarCheck2,
  high_value_appointment: Sparkles,
  last_minute_reminders: Clock,
  post_appointment_followup: MessageSquareHeart,
  review_request: Star,
  reschedule_followup: RefreshCcw,
  no_show_recovery: UserX,
  reengagement: Heart,
  payment_followup: CreditCard,
};

export function TemplateCard({
  template,
  installed,
  readOnly,
  onSetup,
}: {
  template: WorkflowTemplate;
  installed?: boolean;
  readOnly?: boolean;
  onSetup: () => void;
}) {
  const Icon = TEMPLATE_ICONS[template.id] || Zap;

  return (
    <div className="tv-card tv-template-card">
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="tv-template-icon">
          <Icon size={19} strokeWidth={1.9} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3 className="tv-template-name">{template.name}</h3>
            {template.recommended && <Badge tone="accent">Recommended</Badge>}
            {installed && <Badge tone="success">Installed</Badge>}
          </div>
        </div>
      </div>

      <p className="tv-template-desc">{template.description}</p>

      <div className="tv-template-meta">
        <Chip>{triggerLabel(template.trigger)}</Chip>
        {template.channels.map((c) => (
          <Chip key={c}>{c}</Chip>
        ))}
        <span style={{ fontSize: 12, color: "var(--tv-text-muted)", fontWeight: 500 }}>
          {template.steps.length} {template.steps.length === 1 ? "step" : "steps"}
        </span>
      </div>

      <div className="tv-template-foot">
        <span style={{ fontSize: 12, color: "var(--tv-text-muted)" }}>{template.category}</span>
        <button
          className={`tv-btn tv-btn-sm ${installed ? "tv-btn-outline" : "tv-btn-primary"}`}
          onClick={onSetup}
          disabled={readOnly}
        >
          {installed ? "Edit workflow" : "Set up"}
        </button>
      </div>
    </div>
  );
}
