"use client";

import { useState } from "react";
import { PendingInvite, INVITE_ROLE_LABELS } from "../mock-data";
import { Button, Card, CardTitle, StatusChip } from "./ui";

export function PendingInvites({
  invites,
  onCancel,
}: {
  invites: PendingInvite[];
  onCancel: (id: string) => Promise<void>;
}) {
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await onCancel(id);
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Card style={{ padding: 0, overflow: "hidden", marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <CardTitle>Pending invitations</CardTitle>
        <StatusChip label={`${invites.length} pending`} tone="warning" />
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {invites.map((invite, i) => (
          <li
            key={invite.id}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "13px 20px",
              borderTop: "1px solid var(--border)",
              background: i % 2 ? "transparent" : undefined,
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>{invite.email}</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
                {INVITE_ROLE_LABELS[invite.role] ?? invite.role}
                {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""}
                {` · expires ${new Date(invite.expiresAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}`}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusChip label="Pending" tone="warning" />
              <Button
                variant="ghost"
                size="sm"
                disabled={cancelling === invite.id}
                onClick={() => cancel(invite.id)}
              >
                {cancelling === invite.id ? "Cancelling…" : "Cancel invite"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
