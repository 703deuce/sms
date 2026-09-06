"use client";

import { useEffect, useState } from "react";
import type { TimelineItem } from "../mock-data";
import { timeline as mockTimeline } from "../mock-data";
import { Card, SectionHeader, formatDateTime } from "./ui";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  Voicemail,
} from "lucide-react";

const KIND_LABEL: Record<TimelineItem["kind"], string> = {
  sms: "SMS",
  call: "Call",
  voice_ai: "AI voice",
  voice_reminder: "Voice reminder",
  voicemail: "Voicemail",
};

const KIND_TONE: Record<TimelineItem["kind"], { bg: string; color: string }> = {
  sms: { bg: "rgba(67,56,202,0.1)", color: "var(--primary)" },
  call: { bg: "#ecfdf5", color: "#059669" },
  voice_ai: { bg: "#f5f3ff", color: "#7c3aed" },
  voice_reminder: { bg: "#f0f9ff", color: "#0284c7" },
  voicemail: { bg: "#fffbeb", color: "#d97706" },
};

function kindIcon(kind: TimelineItem["kind"]) {
  const s = { width: 14, height: 14 };
  if (kind === "sms") return <MessageSquare style={s} />;
  if (kind === "voicemail") return <Voicemail style={s} />;
  return <Phone style={s} />;
}

function directionIcon(direction: string | null | undefined) {
  const dir = (direction || "").toLowerCase();
  if (dir === "in" || dir === "inbound") {
    return (
      <span title="Inbound">
        <ArrowDownLeft style={{ width: 12, height: 12, color: "#059669" }} />
      </span>
    );
  }
  if (dir === "out" || dir === "outbound") {
    return (
      <span title="Outbound">
        <ArrowUpRight style={{ width: 12, height: 12, color: "var(--primary)" }} />
      </span>
    );
  }
  return null;
}

export function ContactActivityTimeline({ contactId }: { contactId: string }) {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contacts/${contactId}/activity`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.error) throw new Error(j.error);
        setItems(j.data?.length ? j.data : mockTimeline);
      })
      .catch(() => {
        if (!cancelled) setItems(mockTimeline);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<ListChecks />}
        title="Activity"
        description="Calls, messages, and AI voice activity for this contact."
      />

      {loading ? (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                borderRadius: 10,
                border: "1px solid var(--border)",
                padding: "12px 14px",
              }}
            >
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0 }} />
              <div style={{ flex: 1, display: "grid", gap: 6, padding: "4px 0" }}>
                <div className="skeleton" style={{ height: 10, width: 130 }} />
                <div className="skeleton" style={{ height: 10, width: "75%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="error-banner" style={{ marginTop: 16 }}>{error}</p>
      ) : items.length === 0 ? (
        <div
          style={{
            marginTop: 16,
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: "36px 16px",
            textAlign: "center",
          }}
        >
          <Mail style={{ width: 20, height: 20, color: "var(--muted-foreground)", margin: "0 auto 8px" }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>No activity yet</p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
            Calls, texts, AI voice, and voicemail for this contact will appear here.
          </p>
          <a
            href="#/conversations"
            className="btn btn-outline"
            style={{ marginTop: 14, display: "inline-flex", textDecoration: "none" }}
          >
            <MessageSquare style={{ width: 14, height: 14 }} />
            Send a message
          </a>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {items.map((item) => {
            const tone = KIND_TONE[item.kind];
            return (
              <div
                key={item.id}
                className="row-hover"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  padding: "12px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      marginTop: 2,
                      display: "flex",
                      width: 32,
                      height: 32,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      background: tone.bg,
                      color: tone.color,
                    }}
                  >
                    {kindIcon(item.kind)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          minWidth: 0,
                          alignItems: "center",
                          gap: 6,
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        <span>{KIND_LABEL[item.kind]}</span>
                        {directionIcon(item.direction)}
                        {item.status ? (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 400,
                              color: "var(--muted-foreground)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            · {item.status}
                          </span>
                        ) : null}
                      </div>
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 12,
                          fontVariantNumeric: "tabular-nums",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {formatDateTime(item.at)}
                      </span>
                    </div>
                    <p style={{ margin: "3px 0 0", fontSize: 13, lineHeight: 1.55, color: "rgba(23,26,33,0.8)" }}>
                      {item.summary}
                    </p>
                    {item.crmSync?.length ? (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {item.crmSync.map((s, idx) => (
                          <span
                            key={idx}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              borderRadius: 999,
                              background: "#ecfdf5",
                              color: "#047857",
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "2px 8px",
                            }}
                          >
                            <span style={{ width: 5, height: 5, borderRadius: 999, background: "#10b981" }} />
                            Synced to {s.provider}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
