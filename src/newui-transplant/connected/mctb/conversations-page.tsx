"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Inbox } from "@/newui-transplant/components/mctb/inbox";
import type { Conversation, MissedCall } from "@/newui-transplant/lib/view-models";
import { mapApiConversationToNewUiInbox } from "@/lib/newui-transplant/adapters/mctb-conversations";
import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import {
  fetchConversation,
  fetchInboxListPage,
  inboxQueryFromFilter,
  patchConversation,
  sendNewMessage,
} from "@/lib/inbox/kimi-inbox-adapter";
import type { Conversation as ApiConversation } from "@/lib/types";

type InboxFilter = "All" | "Needs reply" | "Mine" | "Unassigned" | "Closed" | "Spam";

function filterToQuery(filter: InboxFilter) {
  if (filter === "Mine") return inboxQueryFromFilter({ kind: "mine", key: "open" }, "mctb", { take: 50 });
  if (filter === "Unassigned") return inboxQueryFromFilter({ kind: "all", key: "unassigned" }, "mctb", { take: 50 });
  if (filter === "Closed") return inboxQueryFromFilter({ kind: "all", key: "closed" }, "mctb", { take: 50 });
  if (filter === "Spam") return inboxQueryFromFilter({ kind: "all", key: "spam" }, "mctb", { take: 50 });
  return inboxQueryFromFilter({ kind: "all", key: "open" }, "mctb", { take: 50 });
}

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
  const [filter, setFilter] = useState<InboxFilter>(initialFilter === "Needs reply" ? "Needs reply" : "All");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const query = filterToQuery(filter);
      const page = await fetchInboxListPage(query);
      const rows = page.rows;
      const loaded: ApiConversation[] = [];
      for (const row of rows.slice(0, 40)) {
        const full = await fetchConversation(row.id);
        if (full) loaded.push(full);
      }
      if (initialConversationId && !loaded.some((c) => c.id === initialConversationId)) {
        const one = await fetchConversation(initialConversationId);
        if (one) loaded.unshift(one);
      }
      let mapped = loaded.map(mapApiConversationToNewUiInbox);
      if (filter === "Needs reply") mapped = mapped.filter((c) => c.needsReply);
      setConversations(mapped);
      const missed: MissedCall[] = [];
      for (const c of loaded) {
        if (!c.missedCallEventId) continue;
        missed.push({
          id: c.missedCallEventId,
          caller: c.contactName || c.phone,
          phone: c.phone,
          missed: c.missedCallDetectedAt
            ? new Date(c.missedCallDetectedAt).toLocaleString()
            : "—",
          trigger: "No answer",
          recovery: "Sent",
          reply: null,
          line: business.line,
          conversationId: c.id,
        });
      }
      setMissedCalls(missed);
    } catch {
      setConversations([]);
      setMissedCalls([]);
    } finally {
      setLoading(false);
    }
  }, [filter, initialConversationId, business.line]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const wiring = useMemo(
    () => ({
      filter,
      onFilterChange: setFilter,
      onMarkRead: async (ids: string[]) => {
        for (const id of ids) {
          await patchConversation(id, { unread: false });
        }
        await loadList();
      },
      onClose: async (ids: string[]) => {
        for (const id of ids) {
          await patchConversation(id, { status: "Closed" });
        }
        await loadList();
      },
      onSendMessage: async (conversationId: string, text: string) => {
        const convo = conversations.find((c) => c.id === conversationId);
        if (!convo) return;
        await sendNewMessage({
          to: convo.phone,
          message: text,
          inboxCompose: true,
        });
        const refreshed = await fetchConversation(conversationId);
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? mapApiConversationToNewUiInbox(refreshed) : c)),
        );
      },
    }),
    [filter, conversations, loadList],
  );

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
      wiring={wiring}
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
