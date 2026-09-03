/**
 * Backend adapter shell for Kimi conversations inbox.
 * Orchestrates the unchanged Kimi presentation components with real /api/inbox data.
 * Kimi UI files under components/kimi/conversations/ are not modified for backend work.
 */
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Conversation as ApiConversation, User } from "@/lib/types";
import InboxRail, { FilterSel } from "@/components/kimi/conversations/components/InboxRail";
import ConversationList from "@/components/kimi/conversations/components/ConversationList";
import BulkActionsBar from "@/components/kimi/conversations/components/BulkActionsBar";
import TagsSettings from "@/components/kimi/conversations/components/TagsSettings";
import SettingsHome from "@/components/kimi/conversations/components/SettingsHome";
import InboxSettings from "@/components/kimi/conversations/components/InboxSettings";
import type { Conversation, Tag } from "@/components/kimi/conversations/mock-data";
import { ConversationsContactPanel } from "@/components/inbox/conversations-contact-panel";
import { ConversationsThreadArea } from "@/components/inbox/conversations-thread-area";
import { ConversationsInboxSettingsWired } from "@/components/inbox/conversations-inbox-settings-wired";
import { InboxProductFilters } from "@/components/inbox/inbox-product-filters";
import { MessageSquarePlus, MessagesSquare, SendHorizonal, X, Loader2 } from "lucide-react";
import {
  buildTagsFromConversations,
  buildTeammates,
  inboxTagDefinitionsToKimi,
  downloadTranscript,
  fetchConversation,
  fetchConversationForContact,
  fetchContactSummary,
  fetchInboxListPage,
  inboxQueryFromFilter,
  kimiStatusToApi,
  mapApiConversationToKimi,
  mapListItemToKimi,
  mergeTagCatalog,
  patchConversation,
  resolveAssigneeApiId,
  searchContacts,
  sendNewMessage,
  syncConversationUpdate,
  resolveInboxPerms,
  tagKeysToApiNames,
  type KimiInboxContext,
} from "@/lib/inbox/kimi-inbox-adapter";
import type { InboxPermissionsJson, InboxTagDefinition } from "@/lib/messaging/messaging-settings";
import { DEFAULT_INBOX_PERMISSIONS } from "@/lib/messaging/messaging-settings";
import {
  filterSelFromUrlParams,
  filterSelToSearchParams,
} from "@/lib/inbox/conversation-url-filters";
import { INBOX_LIST_DEFAULT_TAKE } from "@/lib/inbox/inbox-pagination";
import {
  fetchMessagingRuntimeSettings,
  inboxTagsFromSettings,
  persistInboxTag,
  deleteInboxTag,
  updateInboxTag,
} from "@/lib/auto-replies/kimi-messaging-settings-adapter";

type View = "inbox" | "settings" | "inboxSettings" | "generalInboxSettings" | "tags";

type Props = {
  initialConversations: ApiConversation[];
  teamMembers: User[];
  currentUserId: string;
  currentUserName: string;
  initialPermissions?: InboxPermissionsJson;
  initialConversationId?: string | null;
  initialContactId?: string | null;
  initialDraft?: string;
};

export function KimiConversationsConnected({
  initialConversations,
  teamMembers,
  currentUserId,
  currentUserName,
  initialPermissions,
  initialConversationId = null,
  initialContactId = null,
  initialDraft = "",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParams = useMemo(
    () => Object.fromEntries(searchParams.entries()),
    [searchParams],
  );
  const urlConversation = searchParams.get("conversation") || initialConversationId;
  const urlContactId =
    searchParams.get("contactId") ||
    searchParams.get("contact") ||
    initialContactId;
  const urlDraft = searchParams.get("draft")
    ? decodeURIComponent(searchParams.get("draft")!)
    : initialDraft;
  const urlProduct = searchParams.get("product") || "all";
  const urlPhoneNumberId = searchParams.get("phoneNumberId") || undefined;
  const urlCampaignId = searchParams.get("campaignId") || undefined;
  const urlQ = searchParams.get("q") || "";

  const ctx = useMemo<KimiInboxContext>(
    () => ({ currentUserId, currentUserName, teamMembers }),
    [currentUserId, currentUserName, teamMembers],
  );

  const initialSel = useMemo((): FilterSel => filterSelFromUrlParams(urlParams), [urlParams]);

  const teammates = useMemo(() => buildTeammates(ctx), [ctx]);

  const [persistedTags, setPersistedTags] = useState<Tag[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<InboxTagDefinition[]>([]);
  const [permissions, setPermissions] = useState<InboxPermissionsJson>(
    () => resolveInboxPerms(initialPermissions ?? DEFAULT_INBOX_PERMISSIONS),
  );
  const [permissionsReady, setPermissionsReady] = useState(Boolean(initialPermissions));

  useEffect(() => {
    void fetchMessagingRuntimeSettings()
      .then((s) => {
        const defs = inboxTagsFromSettings(s.inboxTagsJson);
        setTagDefinitions(defs);
        setPersistedTags(inboxTagDefinitionsToKimi(defs));
        setPermissions(resolveInboxPerms(s.inboxPermissionsJson));
        setPermissionsReady(true);
      })
      .catch(() => setPermissionsReady(true));
  }, []);

  const [convos, setConvos] = useState<Conversation[]>(() =>
    initialConversations.map((c) => mapApiConversationToKimi(c, ctx)),
  );

  const tags = useMemo(() => {
    const fromConvos = buildTagsFromConversations(convos);
    return mergeTagCatalog(persistedTags, fromConvos);
  }, [convos, persistedTags]);
  const mapConvo = useCallback(
    (c: ApiConversation) => mapApiConversationToKimi(c, ctx, tags, tagDefinitions),
    [ctx, tags, tagDefinitions],
  );

  const mapRow = useCallback(
    (r: Parameters<typeof mapListItemToKimi>[0]) => mapListItemToKimi(r, ctx, tags, tagDefinitions),
    [ctx, tags, tagDefinitions],
  );

  const [sel, setSel] = useState<FilterSel>(initialSel);
  const [selectedId, setSelectedId] = useState<string | null>(() => urlConversation || null);
  const [searchQuery, setSearchQuery] = useState(urlQ);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; number: string; label?: string }>>([]);
  const [apiConvoById, setApiConvoById] = useState<Record<string, ApiConversation>>({});
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [view, setView] = useState<View>("inbox");
  const [settingsReturn, setSettingsReturn] = useState<View>("inbox");
  const [error, setError] = useState("");
  const updateInFlightRef = useRef(false);
  const listRequestRef = useRef(0);
  const pendingConversationRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const urlSyncedRef = useRef(false);
  const retainInitialConvosRef = useRef(initialConversations.length > 0);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const listQueryExtra = useMemo(
    () => ({
      phoneNumberId: urlPhoneNumberId,
      campaignId: urlCampaignId,
      q: urlQ.trim() || undefined,
    }),
    [urlPhoneNumberId, urlCampaignId, urlQ],
  );

  const clearEphemeralUrlParams = useCallback(() => {
    const params = filterSelToSearchParams(sel, searchParams);
    if (urlProduct && urlProduct !== "all") params.set("product", urlProduct);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (urlPhoneNumberId) params.set("phoneNumberId", urlPhoneNumberId);
    if (urlCampaignId) params.set("campaignId", urlCampaignId);
    params.delete("contactId");
    params.delete("contact");
    params.delete("draft");
    const suffix = params.toString();
    router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
  }, [sel, searchParams, urlProduct, searchQuery, urlPhoneNumberId, urlCampaignId, router]);

  useEffect(() => {
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const rows = ((json?.data || []) as Array<{ id: string; number: string; friendlyName?: string }>).map(
          (n) => ({
            id: n.id,
            number: n.number,
            label: n.friendlyName || n.number,
          }),
        );
        setPhoneNumbers(rows);
        setComposeNumberId((prev) => prev || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchQuery.trim() === urlQ) return;
      const params = filterSelToSearchParams(sel, searchParams);
      if (urlProduct && urlProduct !== "all") params.set("product", urlProduct);
      if (urlPhoneNumberId) params.set("phoneNumberId", urlPhoneNumberId);
      if (urlCampaignId) params.set("campaignId", urlCampaignId);
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      else params.delete("q");
      router.replace(`/conversations?${params.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(t);
  }, [searchQuery, urlQ, sel, searchParams, urlProduct, urlPhoneNumberId, urlCampaignId, router]);

  useEffect(() => {
    setSearchQuery(urlQ);
  }, [urlQ]);

  useEffect(() => {
    setSel(initialSel);
  }, [initialSel]);

  useEffect(() => {
    if (urlSyncedRef.current) return;
    if (searchParams.get("filter") || searchParams.get("tag") || searchParams.get("assigneeId")) {
      urlSyncedRef.current = true;
      return;
    }
    urlSyncedRef.current = true;
    const params = filterSelToSearchParams({ kind: "all", key: "all" }, searchParams);
    if (urlProduct && urlProduct !== "all") params.set("product", urlProduct);
    if (urlPhoneNumberId) params.set("phoneNumberId", urlPhoneNumberId);
    if (urlCampaignId) params.set("campaignId", urlCampaignId);
    if (urlQ.trim()) params.set("q", urlQ.trim());
    const suffix = params.toString();
    router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
  }, [router, searchParams, urlProduct, urlPhoneNumberId, urlCampaignId, urlQ]);

  useEffect(() => {
    if (!tagDefinitions.length) return;
    setConvos((prev) =>
      prev.map((c) => ({
        ...c,
        tags: c.tags.map((key) => {
          const def = tagDefinitions.find((d) => d.id === key || d.name === key);
          return def ? def.name : key;
        }),
      })),
    );
  }, [tagDefinitions]);

  const consumedContactRef = useRef<string | null>(null);

  useEffect(() => {
    if (!urlContactId || !permissionsReady) return;
    if (consumedContactRef.current === urlContactId) return;
    let cancelled = false;
    void fetchConversationForContact(urlContactId)
      .then(async (data) => {
        if (cancelled) return;
        consumedContactRef.current = urlContactId;
        if (data) {
          const mapped = mapConvo(data);
          setConvos((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [mapped, ...prev]));
          setSelectedId(mapped.id);
          if (urlDraft && permissions.allowStartConversations !== false) {
            setNewMsgOpen(true);
            setComposeTo(mapped.phone);
            setComposeQuery(mapped.name);
            setComposePicked(true);
            setComposeMessage(urlDraft);
          }
          clearEphemeralUrlParams();
          return;
        }
        const contact = await fetchContactSummary(urlContactId);
        if (!contact || cancelled) return;
        if (permissions.allowStartConversations === false) {
          clearEphemeralUrlParams();
          return;
        }
        setNewMsgOpen(true);
        setComposeTo(contact.phone);
        setComposeQuery(contact.name);
        setComposePicked(true);
        if (urlDraft) setComposeMessage(urlDraft);
        clearEphemeralUrlParams();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [urlContactId, urlDraft, mapConvo, clearEphemeralUrlParams, permissionsReady, permissions.allowStartConversations]);

  useEffect(() => {
    if (!urlDraft || urlContactId || permissions.allowStartConversations === false) return;
    setNewMsgOpen(true);
    setComposeMessage(urlDraft);
    clearEphemeralUrlParams();
  }, [urlDraft, urlContactId, clearEphemeralUrlParams, permissions.allowStartConversations]);

  useEffect(() => {
    if (!urlConversation) return;
    if (urlConversation !== selectedId) setSelectedId(urlConversation);
    let cancelled = false;
    void fetchConversation(urlConversation)
      .then((data) => {
        if (cancelled) return;
        const mapped = mapConvo(data);
        setApiConvoById((prev) => ({ ...prev, [data.id]: data }));
        setConvos((prev) =>
          prev.some((c) => c.id === mapped.id)
            ? prev.map((c) => (c.id === mapped.id ? mapped : c))
            : [mapped, ...prev],
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open conversation");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [urlConversation, selectedId, mapConvo]);

  const [composeQuery, setComposeQuery] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composePicked, setComposePicked] = useState(false);
  const [composeMessage, setComposeMessage] = useState(urlDraft || "");
  const [composeContacts, setComposeContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [composeSending, setComposeSending] = useState(false);
  const [composeNumberId, setComposeNumberId] = useState("");
  const [listHasMore, setListHasMore] = useState(false);
  const [listCursor, setListCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [myPresenceStatus, setMyPresenceStatus] = useState("available");
  const [presenceByUserId, setPresenceByUserId] = useState<Record<string, string>>({});
  const composeFromRef = useRef<string | undefined>(undefined);

  const presenceBootstrapped = useRef(false);

  const reloadList = useCallback(async (): Promise<Conversation[]> => {
    const requestId = ++listRequestRef.current;
    setListLoading(true);
    try {
      const page = await fetchInboxListPage({
        ...inboxQueryFromFilter(sel, urlProduct, listQueryExtra),
        take: INBOX_LIST_DEFAULT_TAKE,
      });
      if (requestId !== listRequestRef.current) return [];
      setListHasMore(page.pagination.hasMore);
      setListCursor(page.pagination.nextCursor);
      const pinId = urlConversation || selectedIdRef.current;
      let merged: Conversation[] = [];
      setConvos((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        merged = page.rows.map((r) => {
          const mapped = mapRow(r);
          const existing = prevById.get(mapped.id);
          if (existing?.messages.length) {
            return { ...mapped, messages: existing.messages };
          }
          return mapped;
        });
        if (merged.length === 0 && prev.length > 0 && retainInitialConvosRef.current) {
          return prev;
        }
        if (merged.length > 0) {
          retainInitialConvosRef.current = false;
        }
        if (pinId && !merged.some((c) => c.id === pinId)) {
          const pinned = prevById.get(pinId);
          if (pinned) merged = [pinned, ...merged];
        }
        return merged;
      });
      return merged;
    } catch (err) {
      if (requestId === listRequestRef.current) {
        setError(err instanceof Error ? err.message : "Could not load conversations");
      }
      return [];
    } finally {
      if (requestId === listRequestRef.current) setListLoading(false);
    }
  }, [sel, urlProduct, mapRow, listQueryExtra, urlConversation]);

  const loadMoreList = useCallback(async () => {
    if (!listHasMore || !listCursor || listLoading) return;
    setListLoading(true);
    try {
      const page = await fetchInboxListPage({
        ...inboxQueryFromFilter(sel, urlProduct, listQueryExtra),
        take: INBOX_LIST_DEFAULT_TAKE,
        cursor: listCursor,
      });
      setListHasMore(page.pagination.hasMore);
      setListCursor(page.pagination.nextCursor);
      setConvos((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        const appended = page.rows
          .map((r) => {
            const mapped = mapRow(r);
            const existing = prevById.get(mapped.id);
            return existing?.messages.length ? { ...mapped, messages: existing.messages } : mapped;
          })
          .filter((row) => !prevById.has(row.id));
        return [...prev, ...appended];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load more conversations");
    } finally {
      setListLoading(false);
    }
  }, [listHasMore, listCursor, listLoading, sel, urlProduct, mapRow, listQueryExtra]);

  useEffect(() => {
    if (view !== "inbox") return;
    const loadPresence = () => {
      void fetch("/api/phone/presence")
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!json) return;
          const rows = (json.data || []) as Array<{ userId: string; status: string }>;
          const map: Record<string, string> = {};
          for (const row of rows) map[row.userId] = row.status;
          setPresenceByUserId(map);
          const mine = rows.find((r) => r.userId === json.me);
          if (mine?.status) {
            setMyPresenceStatus(mine.status);
          } else if (json.me && !presenceBootstrapped.current) {
            presenceBootstrapped.current = true;
            void fetch("/api/phone/presence", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "available", queueAvailable: true }),
            }).catch(() => undefined);
          }
        })
        .catch(() => undefined);
    };
    loadPresence();
    const timer = setInterval(loadPresence, 30000);
    return () => clearInterval(timer);
  }, [view]);

  const setPresenceStatus = useCallback((status: string) => {
    setMyPresenceStatus(status);
    void fetch("/api/phone/presence", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, queueAvailable: status !== "dnd" }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!json?.data) return;
        setPresenceByUserId((prev) => ({ ...prev, [json.data.userId]: json.data.status }));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (view !== "inbox" || !selectedId) return;
    const timer = setInterval(() => {
      if (updateInFlightRef.current) return;
      void fetchConversation(selectedId)
        .then((data) => {
          if (updateInFlightRef.current) return;
          const mapped = mapConvo(data);
          setApiConvoById((prev) => ({ ...prev, [data.id]: data }));
          setConvos((prev) => prev.map((c) => (c.id === selectedId ? mapped : c)));
        })
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [selectedId, mapConvo, view]);

  useEffect(() => {
    if (!permissionsReady || view !== "inbox") return;
    void reloadList();
  }, [permissionsReady, view, reloadList]);

  useEffect(() => {
    if (view !== "inbox" || !selectedId) return;
    let cancelled = false;
    fetchConversation(selectedId)
      .then((data) => {
        if (cancelled) return;
        const mapped = mapConvo(data);
        setApiConvoById((prev) => ({ ...prev, [data.id]: data }));
        setConvos((prev) => {
          if (prev.some((c) => c.id === selectedId)) {
            return prev.map((c) => (c.id === selectedId ? mapped : c));
          }
          return [mapped, ...prev];
        });
        if (mapped.unread) {
          void patchConversation(selectedId, { unread: false }).catch(() => undefined);
          setConvos((prev) => prev.map((c) => (c.id === selectedId ? { ...mapped, unread: false } : c)));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load conversation");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId, mapConvo, view]);

  useEffect(() => {
    if (!newMsgOpen) return;
    const t = setTimeout(() => {
      void searchContacts(composeQuery).then(setComposeContacts);
    }, 200);
    return () => clearTimeout(t);
  }, [composeQuery, newMsgOpen]);

  const counts = useMemo(() => {
    const mine = convos.filter((c) => c.assignee === "me");
    const c: Record<string, number> = {
      mineAll: mine.length,
      mineUnread: mine.filter((x) => x.unread).length,
      mineOpen: mine.filter((x) => x.status === "open").length,
      minePending: mine.filter((x) => x.status === "pending").length,
      allAll: convos.length,
      unassigned: convos.filter((x) => !x.assignee).length,
      allUnread: convos.filter((x) => x.unread).length,
      allOpen: convos.filter((x) => x.status === "open").length,
      allPending: convos.filter((x) => x.status === "pending").length,
      closed: convos.filter((x) => x.status === "closed").length,
      snoozed: convos.filter((x) => x.status === "snoozed").length,
      spam: convos.filter((x) => x.status === "spam").length,
    };
    tags.forEach((t) => {
      const tagged = convos.filter((x) => x.tags.includes(t.id));
      c[`tag:${t.id}`] = tagged.length;
      ["all", "open", "pending", "closed"].forEach((s) => {
        c[`tag:${t.id}:${s}`] = s === "all" ? tagged.length : tagged.filter((x) => x.status === s).length;
      });
    });
    teammates.forEach((t) => {
      if (t.id === "me") return;
      const owned = convos.filter((x) => x.assignee === t.id);
      c[`tm:${t.id}`] = owned.length;
      ["all", "open", "pending"].forEach((s) => {
        c[`tm:${t.id}:${s}`] = s === "all" ? owned.length : owned.filter((x) => x.status === s).length;
      });
    });
    return c;
  }, [convos, tags, teammates]);

  const filtered = useMemo(
    () => {
      const rows = convos.filter((c) => {
        if (sel.kind === "mine") {
          if (c.assignee !== "me") return false;
          if (sel.key === "unread") return !!c.unread;
          if (sel.key === "open" || sel.key === "pending") return c.status === sel.key;
          return true;
        }
        if (sel.kind === "all") {
          if (sel.key === "unassigned") return !c.assignee;
          if (sel.key === "unread") return !!c.unread;
          if (sel.key === "all") return true;
          return c.status === sel.key;
        }
        if (sel.kind === "tag") {
          if (!c.tags.includes(sel.key)) return false;
          return sel.sub ? c.status === sel.sub : true;
        }
        if (c.assignee !== sel.key) return false;
        return sel.sub ? c.status === sel.sub : true;
      });
      return sortOrder === "oldest" ? [...rows].reverse() : rows;
    },
    [convos, sel, sortOrder],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (filtered.some((c) => c.id === selectedId)) return;
    if (convos.some((c) => c.id === selectedId)) return;
    if (urlConversation === selectedId) return;
    if (pendingConversationRef.current === selectedId) return;
    if (listLoading) return;
    setSelectedId(null);
  }, [filtered, selectedId, convos, urlConversation, listLoading]);

  useEffect(() => {
    if (urlConversation && urlConversation === selectedId) {
      pendingConversationRef.current = null;
    }
  }, [urlConversation, selectedId]);

  const listConvos = useMemo(() => {
    if (!selectedId || filtered.some((c) => c.id === selectedId)) return filtered;
    const pinned = convos.find((c) => c.id === selectedId);
    return pinned ? [pinned, ...filtered] : filtered;
  }, [filtered, selectedId, convos]);

  const title =
    sel.kind === "mine"
      ? "Me"
      : sel.kind === "all"
        ? "Everyone"
        : sel.kind === "tag"
          ? (tags.find((t) => t.id === sel.key)?.name ?? "Tag")
          : (teammates.find((t) => t.id === sel.key)?.name ?? "Teammate");
  const subtitle =
    sel.kind === "mine" && sel.key === "unread"
      ? "Unread Conversations"
      : sel.sub
        ? `${sel.sub[0].toUpperCase()}${sel.sub.slice(1)} Conversations`
        : sel.kind === "mine" || sel.kind === "all"
          ? sel.key === "all"
            ? "All Conversations"
            : `${sel.key[0].toUpperCase()}${sel.key.slice(1)} Conversations`
          : "All Conversations";

  const selected = convos.find((c) => c.id === selectedId) ?? null;

  const campaignFilterLabel = useMemo(() => {
    if (!urlCampaignId) return null;
    const fromConvo = convos.find((c) => c.campaignId === urlCampaignId && c.campaignName);
    return fromConvo?.campaignName ?? null;
  }, [urlCampaignId, convos]);

  const clearCampaignFilter = useCallback(() => {
    const params = filterSelToSearchParams(sel, searchParams);
    if (urlProduct && urlProduct !== "all") params.set("product", urlProduct);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (urlPhoneNumberId) params.set("phoneNumberId", urlPhoneNumberId);
    params.delete("campaignId");
    if (selectedId) params.set("conversation", selectedId);
    const suffix = params.toString();
    router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
  }, [sel, searchParams, urlProduct, searchQuery, urlPhoneNumberId, selectedId, router]);

  const update = useCallback(
    async (next: Conversation) => {
      const prev = convos.find((c) => c.id === next.id);
      if (!prev) return;
      updateInFlightRef.current = true;
      setConvos((p) =>
        p.map((x) =>
          x.id === next.id ? { ...next, unread: selectedId === next.id ? false : next.unread } : x,
        ),
      );
      try {
        const data = await syncConversationUpdate(prev, next, ctx, tags, {
          fromE164: composeFromRef.current,
        });
        composeFromRef.current = undefined;
        if (data) {
          const mapped = mapConvo(data);
          setConvos((p) => p.map((x) => (x.id === next.id ? mapped : x)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update conversation");
        setConvos((p) => p.map((x) => (x.id === prev.id ? prev : x)));
      } finally {
        updateInFlightRef.current = false;
      }
    },
    [convos, ctx, selectedId, tags, mapConvo],
  );

  const toggleCheck = (id: string, v: boolean) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  const checkAll = (v: boolean) =>
    setChecked(v ? new Set(filtered.map((c) => c.id)) : new Set());

  const bulk = async (action: string) => {
    const [kind, val] = action.split(":");
    const ids = Array.from(checked);
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        if (kind === "status") {
          const data = await patchConversation(id, {
            status: kimiStatusToApi(val as Conversation["status"]),
          });
          const mapped = mapConvo(data);
          setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
          return;
        }
        if (kind === "assign") {
          const data = await patchConversation(id, {
            assigneeId: resolveAssigneeApiId(val || null, ctx),
          });
          const mapped = mapConvo(data);
          setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
          return;
        }
        if (kind === "tag") {
          const row = convos.find((c) => c.id === id);
          if (!row) return;
          const next =
            val === "clear" ? [] : Array.from(new Set([...row.tags, val]));
          const data = await patchConversation(id, {
            tags: tagKeysToApiNames(next, tags),
          });
          const mapped = mapConvo(data);
          setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
          return;
        }
        if (kind === "mark") {
          const data = await patchConversation(id, { unread: val === "unread" });
          const mapped = mapConvo(data);
          setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
        }
      }),
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setError(
        failed === ids.length
          ? "Bulk action failed"
          : `${failed} of ${ids.length} conversations could not be updated`,
      );
    }
    setChecked(new Set());
    void reloadList();
  };

  const syncUrl = useCallback(
    (nextSel: FilterSel, opts?: { conversationId?: string | null; clearConversation?: boolean }) => {
      const params = filterSelToSearchParams(nextSel, searchParams);
      if (urlProduct && urlProduct !== "all") params.set("product", urlProduct);
      else params.delete("product");
      if (searchQuery.trim()) params.set("q", searchQuery.trim());
      if (urlPhoneNumberId) params.set("phoneNumberId", urlPhoneNumberId);
      if (urlCampaignId) params.set("campaignId", urlCampaignId);
      if (opts?.clearConversation) params.delete("conversation");
      else if (opts?.conversationId) params.set("conversation", opts.conversationId);
      const suffix = params.toString();
      router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
    },
    [router, searchParams, urlProduct, searchQuery, urlPhoneNumberId, urlCampaignId],
  );

  useEffect(() => {
    if (!selectedId && urlConversation) {
      syncUrl(sel, { clearConversation: true });
    }
  }, [selectedId, urlConversation, sel, syncUrl]);

  const pickConvo = (c: Conversation) => {
    pendingConversationRef.current = c.id;
    setSelectedId(c.id);
    syncUrl(sel, { conversationId: c.id });
    if (c.unread) {
      setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: false } : x)));
      void patchConversation(c.id, { unread: false }).catch(() => undefined);
    }
  };

  const handleComposeSend = async () => {
    if (!canStartConversations) return;
    const to = (composePicked ? composeTo : composeQuery).trim();
    if (!to || !composeMessage.trim()) return;
    setComposeSending(true);
    setError("");
    const message = composeMessage.trim();
    const fromE164 = phoneNumbers.find((n) => n.id === composeNumberId)?.number;
    try {
      const { conversationId } = await sendNewMessage({ to, message, fromE164, inboxCompose: true });
      setNewMsgOpen(false);
      setComposeTo("");
      setComposeQuery("");
      setComposePicked(false);
      setComposeMessage("");
      clearEphemeralUrlParams();
      if (conversationId) {
        const data = await fetchConversation(conversationId);
        const mapped = mapConvo(data);
        setApiConvoById((prev) => ({ ...prev, [data.id]: data }));
        setConvos((prev) =>
          prev.some((c) => c.id === mapped.id)
            ? prev.map((c) => (c.id === mapped.id ? mapped : c))
            : [mapped, ...prev],
        );
        setSelectedId(mapped.id);
        syncUrl(sel, { conversationId: mapped.id });
        return;
      }
      const rows = await reloadList();
      const normalized = to.replace(/\D/g, "");
      const match = rows.find((c) => c.phone.replace(/\D/g, "") === normalized);
      if (match) {
        setSelectedId(match.id);
        syncUrl(sel, { conversationId: match.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setComposeSending(false);
    }
  };

  const canStartConversations = permissions.allowStartConversations !== false;
  const canAssign = permissions.allowAssignment !== false;
  const canTag = permissions.allowTagging !== false;
  const inboxEnabled = permissions.inboxEnabled !== false;
  const composerBlocked =
    !canStartConversations && selected?.status === "closed";
  const composerBlockedReason = composerBlocked
    ? "Replies to closed conversations are disabled in inbox settings."
    : undefined;
  const composeRecipient = (composePicked ? composeTo : composeQuery).trim();

  if (!permissionsReady) {
    return (
      <div className="ref-scope" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <p className="text-sm text-slate-500">Loading inbox…</p>
      </div>
    );
  }

  if (!inboxEnabled) {
    return (
      <div className="ref-scope" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Inbox is disabled</h2>
          <p style={{ color: "#6b7280", marginTop: 8 }}>
            Turn on inbox messaging in settings to use conversations.
          </p>
          <button
            type="button"
            className="tv-btn"
            style={{ marginTop: 16 }}
            onClick={() => { setSettingsReturn("inbox"); setView("generalInboxSettings"); }}
          >
            Open inbox settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ref-scope" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {error ? (
        <div
          style={{
            position: "fixed",
            top: 12,
            right: 12,
            zIndex: 200,
            background: "#fef2f2",
            color: "#b91c1c",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: 360,
          }}
        >
          <span style={{ flex: 1 }}>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            style={{ border: "none", background: "transparent", color: "#b91c1c", cursor: "pointer", fontWeight: 700 }}
          >
            ×
          </button>
        </div>
      ) : null}

      {view === "settings" ? (
        <SettingsHome onOpenInbox={() => { setSettingsReturn("settings"); setView("inboxSettings"); }} />
      ) : view === "inboxSettings" ? (
        <InboxSettings
          onBack={() => setView(settingsReturn)}
          onOpenTags={() => setView("tags")}
          onOpenMessagingSettings={() => setView("generalInboxSettings")}
        />
      ) : view === "generalInboxSettings" ? (
        <ConversationsInboxSettingsWired
          onBack={() => setView("inboxSettings")}
          onSaved={(perms) => setPermissions(resolveInboxPerms(perms))}
        />
      ) : view === "tags" ? (
        <TagsSettings
          tags={tags}
          onBack={() => setView("inboxSettings")}
          onCreate={(t) => {
            void persistInboxTag({
              name: t.name,
              description: t.description,
              color: t.color,
              untagOnClose: t.untagOnClose,
            })
              .then((rows) => {
                setTagDefinitions(rows);
                setPersistedTags(inboxTagDefinitionsToKimi(rows));
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not save tag"));
          }}
          onDelete={(name) => {
            void deleteInboxTag(name)
              .then((rows) => {
                setTagDefinitions(rows);
                setPersistedTags(inboxTagDefinitionsToKimi(rows));
                void reloadList();
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not delete tag"));
          }}
          onEdit={(originalName, patch) => {
            void updateInboxTag(originalName, patch)
              .then((rows) => {
                setTagDefinitions(rows);
                setPersistedTags(inboxTagDefinitionsToKimi(rows));
                void reloadList();
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not update tag"));
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div className="tv-product-filters-bar">
            <InboxProductFilters basePath="/conversations" />
          </div>
          {urlCampaignId ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "8px 16px",
                background: "var(--tv-primary-soft)",
                borderBottom: "1px solid var(--tv-border)",
                fontSize: 13,
              }}
            >
              <span style={{ color: "var(--tv-text)" }}>
                Showing replies for campaign{" "}
                <strong>{campaignFilterLabel || urlCampaignId}</strong>
              </span>
              <button
                type="button"
                onClick={clearCampaignFilter}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--tv-primary)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear filter
              </button>
            </div>
          ) : null}
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <div className={selectedId ? "conversations-rail--mobile-hidden" : undefined} style={{ display: "flex", flexShrink: 0 }}>
          <InboxRail
            sel={sel}
            onSel={(s) => {
              setSel(s);
              setChecked(new Set());
              retainInitialConvosRef.current = false;
              syncUrl(s, selectedId ? { conversationId: selectedId } : { clearConversation: true });
            }}
            counts={counts}
            tags={tags}
            teammates={teammates}
            onNew={() => canStartConversations && setNewMsgOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSettings={() => { setSettingsReturn("inbox"); setView("inboxSettings"); }}
            myPresenceStatus={myPresenceStatus}
            onPresenceChange={setPresenceStatus}
            presenceByUserId={presenceByUserId}
          />
          </div>
          <ConversationList
            title={title}
            subtitle={subtitle}
            convos={listConvos}
            selectedId={selectedId}
            onSelect={pickConvo}
            checked={checked}
            onCheck={toggleCheck}
            allChecked={filtered.length > 0 && filtered.every((c) => checked.has(c.id))}
            onCheckAll={checkAll}
            sortOrder={sortOrder}
            onToggleSort={() => setSortOrder((s) => (s === "newest" ? "oldest" : "newest"))}
            className={selectedId ? "conversations-list--mobile-hidden" : ""}
            hasMore={listHasMore}
            loadingMore={listLoading}
            loading={listLoading && convos.length === 0}
            onLoadMore={() => void loadMoreList()}
          />
          {checked.size > 0 ? (
            <BulkActionsBar
              count={checked.size}
              onAction={(a) => void bulk(a)}
              tags={tags}
              teammates={teammates}
              allowAssign={canAssign}
              allowTag={canTag}
            />
          ) : selected ? (
            <>
              <ConversationsThreadArea
                convo={selected}
                tags={tags}
                teammates={teammates}
                onUpdate={(c) => void update(c)}
                composeFromRef={composeFromRef}
                contactOpen={contactOpen}
                onToggleContact={() => setContactOpen(!contactOpen)}
                onOpenTagsSettings={() => { setSettingsReturn("inbox"); setView("tags"); }}
                onDownloadTranscript={() => downloadTranscript(selected)}
                allowTagging={canTag}
                allowAssign={canAssign}
                composerDisabled={composerBlocked}
                composerDisabledReason={composerBlockedReason}
                phoneNumbers={phoneNumbers}
                onBack={() => {
                  setSelectedId(null);
                  syncUrl(sel, { clearConversation: true });
                }}
              />
              {contactOpen && (
                <ConversationsContactPanel
                  convo={selected}
                  apiConvo={apiConvoById[selected.id] ?? null}
                  onClose={() => setContactOpen(false)}
                />
              )}
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 16,
                background: "var(--tv-panel)",
              }}
            >
              <span
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 9999,
                  background: "var(--tv-primary-soft)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessagesSquare size={34} color="var(--tv-primary)" strokeWidth={1.5} />
              </span>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.1 }}>
                  No Conversation Selected
                </div>
                <div style={{ fontSize: 12.5, color: "var(--tv-faint)", marginTop: 4 }}>
                  Select a conversation to begin chatting.
                </div>
              </div>
              <button
                type="button"
                className="tv-btn"
                onClick={() => canStartConversations && setNewMsgOpen(true)}
                disabled={!canStartConversations}
                title={!canStartConversations ? "Starting conversations is disabled in inbox settings" : undefined}
              >
                <MessageSquarePlus size={14} /> New Message
              </button>
              <button
                type="button"
                onClick={() => { setSettingsReturn("inbox"); setView("inboxSettings"); }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--tv-primary)",
                  cursor: "pointer",
                  marginTop: 2,
                }}
              >
                Inbox settings →
              </button>
              <button
                type="button"
                onClick={() => { setSettingsReturn("inbox"); setView("tags"); }}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--tv-primary)",
                  cursor: "pointer",
                  marginTop: 2,
                }}
              >
                Manage inbox tags →
              </button>
            </div>
          )}
          </div>
        </div>
      )}

      {newMsgOpen && (
        <div
          className="ref-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(17,24,39,.45)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: 120,
            zIndex: 100,
          }}
          onClick={() => {
            setNewMsgOpen(false);
            clearEphemeralUrlParams();
          }}
        >
          <div
            className="ref-modal"
            style={{
              background: "#fff",
              borderRadius: 14,
              width: 460,
              padding: 22,
              boxShadow: "0 24px 60px rgba(0,0,0,.28)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, flex: 1, letterSpacing: -0.1 }}>
                Compose New Message
              </span>
              <button
                type="button"
                className="tv-icon-btn"
                onClick={() => {
                  setNewMsgOpen(false);
                  clearEphemeralUrlParams();
                }}
                style={{ width: 26, height: 26, border: "none", background: "transparent" }}
              >
                <X size={15} />
              </button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--tv-muted)" }}>To:</label>
            <input
              className="tv-input"
              placeholder="Search or create new contact"
              style={{ margin: "6px 0 8px" }}
              autoFocus
              value={composeQuery}
              onChange={(e) => {
                setComposePicked(false);
                setComposeQuery(e.target.value);
              }}
            />
            {composeContacts.length > 0 && composeQuery ? (
              <div
                style={{
                  border: "1px solid var(--tv-border)",
                  borderRadius: 8,
                  marginBottom: 8,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                {composeContacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setComposeTo(c.phone);
                      setComposeQuery(c.name);
                      setComposePicked(true);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    {c.name} <span style={{ color: "var(--tv-faint)" }}>{c.phone}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {phoneNumbers.length > 0 ? (
              <>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--tv-muted)" }}>From:</label>
                <select
                  className="tv-input"
                  style={{ margin: "6px 0 8px" }}
                  value={composeNumberId}
                  onChange={(e) => setComposeNumberId(e.target.value)}
                >
                  {phoneNumbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label ? `${n.label} — ` : ""}
                      {n.number}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <textarea
              className="tv-input"
              rows={3}
              placeholder="Type a message"
              style={{ resize: "none" }}
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                className="tv-btn-ghost"
                onClick={() => {
                  setNewMsgOpen(false);
                  clearEphemeralUrlParams();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="tv-btn"
                disabled={composeSending || !composeRecipient || !composeMessage.trim()}
                onClick={() => void handleComposeSend()}
              >
                {composeSending ? <Loader2 size={13} className="animate-spin" /> : null}
                Send <SendHorizonal size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
