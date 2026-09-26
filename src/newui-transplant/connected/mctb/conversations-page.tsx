"use client";

import { useEffect, useState } from "react";
import { Inbox } from "@/newui-transplant/components/mctb/inbox";
import type { BusinessContext, Conversation, MissedCall } from "@/newui-transplant/lib/view-models";
import { mapApiConversationToNewUiInbox } from "@/lib/newui-transplant/adapters/mctb-conversations";
import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import { fetchConversation, fetchInboxListPage, sendNewMessage } from "@/lib/inbox/kimi-inbox-adapter";
import type { Conversation as ApiConversation } from "@/lib/types";

export function NewUiMctbConversationsPage({
  initialConversationId,
  initialFilter,
}: {
  initialConversationId?: string;
  initialFilter: "All" | "Needs reply";
}) {
  const { business: opusBusiness } = useOpusWorkspaceData();
  const business =
    opusBusiness ??
    businessContextFromWorkspace({
      name: "Workspace",
    });
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await fetchInboxListPage({ product: "mctb", take: 50 });
        const ids = list.rows.map((i) => i.id);
        const loaded: ApiConversation[] = [];
        for (const id of ids.slice(0, 25)) {
          const full = await fetchConversation(id);
          if (full) loaded.push(full);
        }
        if (initialConversationId && !loaded.some((c) => c.id === initialConversationId)) {
          const one = await fetchConversation(initialConversationId);
          if (one) loaded.unshift(one);
        }
        if (!cancelled) {
          setConversations(loaded.map(mapApiConversationToNewUiInbox));
        }
      } catch {
        if (!cancelled) setConversations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId]);

  if (loading) {
    return <p className="p-6 text-sm text-muted-foreground">Loading conversations…</p>;
  }

  return (
    <Inbox
      initialId={initialConversationId}
      initialFilter={initialFilter}
      conversations={conversations}
      missedCalls={missedCalls}
      business={business}
      onSendMessage={async (conversationId, text) => {
        const convo = conversations.find((c) => c.id === conversationId);
        if (!convo) return;
        await sendNewMessage({
          to: convo.phone,
          message: text,
          inboxCompose: true,
        });
      }}
    />
  );
}

export function defaultMctbInboxBusinessFromSetup(setup: {
  businessLineE164?: string | null;
  senderLabel?: string | null;
  workspaceName: string;
  timezone?: string | null;
}): BusinessContext {
  return businessContextFromWorkspace({
    name: setup.workspaceName,
    businessLineE164: setup.businessLineE164,
    senderE164: setup.senderLabel,
    timezone: setup.timezone,
  });
}
