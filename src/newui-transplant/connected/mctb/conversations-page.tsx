"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Inbox } from "@/newui-transplant/components/mctb/inbox";
import type { Conversation, MissedCall } from "@/newui-transplant/lib/view-models";
import {
  mapApiConversationToNewUiInbox,
  mapInboxListItemToNewUiInbox,
} from "@/lib/newui-transplant/adapters/mctb-conversations";
import { businessContextFromWorkspace } from "@/lib/newui-transplant/adapters/business-context";
import { useOpusWorkspaceData } from "@/newui-transplant/context/opus-workspace-data";
import {
  fetchConversation,
  fetchInboxListPage,
  inboxQueryFromFilter,
  patchConversation,
  sendNewMessage,
} from "@/lib/inbox/kimi-inbox-adapter";

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
  const business = useMemo(
    () =>
      opusBusiness ??
      businessContextFromWorkspace({ name: "Workspace", businessLineE164: null, senderE164: null }),
    [opusBusiness],
  );

  const [filter, setFilter] = useState<InboxFilter>(initialFilter === "Needs reply" ? "Needs reply" : "All");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [missedCalls, setMissedCalls] = useState<MissedCall[]>([]);
  const [loading, setLoading] = useState(true);
  const hydratedIds = useRef(new Set<string>());

  const buildMissedCallsFromRows = useCallback(
    (rows: Conversation[]) => {
      const missed: MissedCall[] = [];
      for (const c of rows) {
        if (!c.missedCallEventId) continue;
        missed.push({
          id: c.missedCallEventId,
          caller: c.name,
          phone: c.phone,
          missed: "—",
          trigger: "No answer",
          recovery: "Sent",
          reply: null,
          line: business.line,
          conversationId: c.id,
        });
      }
      return missed;
    },
    [business.line],
  );

  const hydrateThread = useCallback(async (conversationId: string) => {
    if (hydratedIds.current.has(conversationId)) return;
    hydratedIds.current.add(conversationId);
    try {
      const full = await fetchConversation(conversationId);
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? mapApiConversationToNewUiInbox(full) : c)),
      );
    } catch {
      hydratedIds.current.delete(conversationId);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    hydratedIds.current.clear();
    try {
      const query = filterToQuery(filter);
      const page = await fetchInboxListPage(query);
      let mapped = page.rows.map(mapInboxListItemToNewUiInbox);
      if (filter === "Needs reply") mapped = mapped.filter((c) => c.needsReply);
      setConversations(mapped);
      setMissedCalls(buildMissedCallsFromRows(mapped));
      setLoading(false);

      const toHydrate = initialConversationId ?? mapped[0]?.id;
      if (toHydrate) void hydrateThread(toHydrate);
    } catch {
      setConversations([]);
      setMissedCalls([]);
      setLoading(false);
    }
  }, [filter, initialConversationId, buildMissedCallsFromRows, hydrateThread]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const wiring = useMemo(
    () => ({
      filter,
      onFilterChange: setFilter,
      onSelectionChange: (id: string) => {
        void hydrateThread(id);
      },
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
        hydratedIds.current.add(conversationId);
      },
    }),
    [filter, conversations, loadList, hydrateThread],
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
