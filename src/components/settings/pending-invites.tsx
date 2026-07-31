"use client";

import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { StatusChip } from "@/components/ui/status-chip";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Owner",
  ADMINISTRATOR: "Administrator",
  MANAGER: "Manager",
  CAMPAIGN_CREATOR: "Campaign creator",
  INBOX_AGENT: "Inbox agent",
  ANALYST: "Analyst",
  READ_ONLY: "Read only",
};

export type PendingInviteRow = {
  id: string;
  email: string;
  role: string;
  invitedByName: string | null;
  expiresAt: string;
};

export function PendingInvites({ invites }: { invites: PendingInviteRow[] }) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState<string | null>(null);

  if (invites.length === 0) return null;

  async function cancel(id: string) {
    setCancelling(id);
    try {
      const res = await fetch(`/api/team?inviteId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) router.refresh();
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Card className="mt-4">
      <div className="mb-4 flex items-center justify-between">
        <CardTitle>Pending invitations</CardTitle>
        <span className="text-xs text-muted-foreground">{invites.length} pending</span>
      </div>
      <ul className="divide-y divide-border">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium">{invite.email}</p>
              <p className="text-xs text-muted-foreground">
                {ROLE_LABELS[invite.role] || invite.role}
                {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""}
                {` · expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusChip status="Pending" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cancel(invite.id)}
                disabled={cancelling === invite.id}
              >
                {cancelling === invite.id ? "Cancelling…" : "Cancel"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
