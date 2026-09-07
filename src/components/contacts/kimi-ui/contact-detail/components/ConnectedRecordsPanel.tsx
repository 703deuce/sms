"use client";

import { useEffect, useState } from "react";
import type { CrmLink } from "../types";
import { Card, SectionHeader, StatusChip } from "./ui";
import { Blocks, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "./ui";

function formatMoney(value: number | null, currency: string | null) {
  if (value == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} ${currency || ""}`.trim();
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RecordRow({
  link,
  busy,
  onAction,
}: {
  link: CrmLink;
  busy: string | null;
  onAction: (provider: string, action: string) => void;
}) {
  return (
    <div
      className="row-hover"
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        background: "var(--card)",
        padding: "12px 14px",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <StatusChip status={link.displayName} />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)", textTransform: "capitalize" }}>
              {link.objectType}
            </span>
            {link.name ? (
              <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis" }}>
                {link.name}
              </span>
            ) : null}
            {link.conflict ? (
              <span style={{ borderRadius: 999, background: "#fef3c7", color: "#92400e", fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>
                Conflict
              </span>
            ) : null}
            {link.pendingSync ? (
              <span style={{ borderRadius: 999, background: "#e0e7ff", color: "#3730a3", fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>
                Pending sync
              </span>
            ) : null}
            {link.syncFailure ? (
              <span style={{ borderRadius: 999, background: "#fee2e2", color: "#b91c1c", fontSize: 10, fontWeight: 700, padding: "2px 8px" }}>
                Sync failed
              </span>
            ) : null}
          </div>

          <dl
            style={{
              margin: "8px 0 0",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "4px 16px",
              fontSize: 12,
            }}
          >
            {link.owner ? (
              <div>
                <dt style={{ display: "inline", color: "var(--muted-foreground)" }}>Owner: </dt>
                <dd style={{ display: "inline", margin: 0 }}>{link.owner}</dd>
              </div>
            ) : null}
            {link.stage ? (
              <div>
                <dt style={{ display: "inline", color: "var(--muted-foreground)" }}>Stage: </dt>
                <dd style={{ display: "inline", margin: 0 }}>{link.stage}</dd>
              </div>
            ) : null}
            {link.dealValue != null ? (
              <div>
                <dt style={{ display: "inline", color: "var(--muted-foreground)" }}>Value: </dt>
                <dd style={{ display: "inline", margin: 0 }}>{formatMoney(link.dealValue, link.currency)}</dd>
              </div>
            ) : null}
            <div>
              <dt style={{ display: "inline", color: "var(--muted-foreground)" }}>Last synced: </dt>
              <dd style={{ display: "inline", margin: 0, fontVariantNumeric: "tabular-nums" }}>
                {formatWhen(link.lastSyncedAt)}
              </dd>
            </div>
          </dl>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <Button
            variant="ghost"
            onClick={() => onAction(link.provider, "sync_now")}
            disabled={busy === link.id}
            aria-label={`Sync ${link.displayName} now`}
          >
            <RefreshCw style={{ width: 13, height: 13 }} />
            {busy === link.id ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="ghost" onClick={() => onAction(link.provider, "task.create")}>
            Create task
          </Button>
          {link.externalUrl ? (
            <a
              href={link.externalUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open in ${link.displayName}`}
              style={{ color: "var(--muted-foreground)", display: "inline-flex", padding: 6 }}
            >
              <ExternalLink style={{ width: 14, height: 14 }} />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ConnectedRecordsPanel({ contactId }: { contactId: string }) {
  const [links, setLinks] = useState<CrmLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contacts/${contactId}/crm-context`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setLinks(j.data?.links || []);
      })
      .catch(() => {
        if (!cancelled) setLinks([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  async function onAction(provider: string, action: string, linkId?: string) {
    setBusy(linkId ?? provider);
    setNotice("");
    try {
      await fetch(`/api/contacts/${contactId}/integrations/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, action }),
      });
      setNotice(
        action === "sync_now"
          ? `Sync requested for ${provider}. Records will refresh shortly.`
          : `Task created in ${provider}.`,
      );
    } catch {
      setNotice("The action could not be completed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={{ padding: 18 }}>
      <SectionHeader
        icon={<Blocks />}
        title="Connected records"
        description="CRM and scheduling records linked to this contact."
      />

      {notice ? (
        <p
          style={{
            margin: "12px 0 0",
            borderRadius: 8,
            background: "#ecfdf5",
            color: "#047857",
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 10px",
            boxShadow: "inset 0 0 0 1px rgba(16,185,129,0.2)",
          }}
          role="status"
        >
          {notice}
        </p>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ borderRadius: 10, border: "1px solid var(--border)", padding: "12px 14px" }}>
              <div className="skeleton" style={{ height: 12, width: "55%" }} />
              <div className="skeleton" style={{ height: 10, width: "80%", marginTop: 8 }} />
            </div>
          ))}
        </div>
      ) : links.length === 0 ? (
        <div
          style={{
            marginTop: 16,
            border: "1px dashed var(--border)",
            borderRadius: 10,
            padding: "28px 16px",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
            No connected records yet. Connect a CRM or scheduling integration to see linked records here.
          </p>
        </div>
      ) : (
        <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
          {links.map((link) => (
            <RecordRow
              key={link.id}
              link={link}
              busy={busy}
              onAction={(p, a) => void onAction(p, a, link.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
