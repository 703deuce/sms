/**
 * Backend adapter shell for Kimi conversations inbox.
 * Orchestrates the unchanged Kimi presentation components with real /api/inbox data.
 * Kimi UI files under components/kimi/conversations/ are not modified.
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
  fetchInboxList,
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
import {
  fetchMessagingRuntimeSettings,
  inboxTagsFromSettings,
  persistInboxTag,
  deleteInboxTag,
} from "@/lib/auto-replies/kimi-messaging-settings-adapter";

type View = "inbox" | "settings" | "inboxSettings" | "tags";

type Props = {
  initialConversations: ApiConversation[];
  teamMembers: User[];
  currentUserId: string;
  currentUserName: string;
  initialConversationId?: string | null;
  initialContactId?: string | null;
  initialDraft?: string;
};

export function KimiConversationsConnected({
  initialConversations,
  teamMembers,
  currentUserId,
  currentUserName,
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

  const ctx = useMemo<KimiInboxContext>(
    () => ({ currentUserId, currentUserName, teamMembers }),
    [currentUserId, currentUserName, teamMembers],
  );

  const initialSel = useMemo((): FilterSel => filterSelFromUrlParams(urlParams), [urlParams]);

  const teammates = useMemo(() => buildTeammates(ctx), [ctx]);

  const [persistedTags, setPersistedTags] = useState<Tag[]>([]);
  const [tagDefinitions, setTagDefinitions] = useState<InboxTagDefinition[]>([]);
  const [permissions, setPermissions] = useState<InboxPermissionsJson>(DEFAULT_INBOX_PERMISSIONS);

  useEffect(() => {
    void fetchMessagingRuntimeSettings()
      .then((s) => {
        const defs = inboxTagsFromSettings(s.inboxTagsJson);
        setTagDefinitions(defs);
        setPersistedTags(inboxTagDefinitionsToKimi(defs));
        setPermissions(resolveInboxPerms(s.inboxPermissionsJson));
      })
      .catch(() => undefined);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [view, setView] = useState<View>("inbox");
  const [settingsReturn, setSettingsReturn] = useState<View>("inbox");
  const [error, setError] = useState("");
  const [productFilter, setProductFilter] = useState(urlProduct);
  const skipInitialReload = useRef(
    !searchParams.get("tag") &&
      !searchParams.get("assigneeId") &&
      !searchParams.get("product"),
  );

  useEffect(() => {
    setProductFilter(urlProduct);
  }, [urlProduct]);

  useEffect(() => {
    setSel(initialSel);
  }, [initialSel]);

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

  useEffect(() => {
    if (!urlContactId) return;
    let cancelled = false;
    void fetchConversationForContact(urlContactId)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          const mapped = mapConvo(data);
          setConvos((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [mapped, ...prev]));
          setSelectedId(mapped.id);
          if (urlDraft) {
            setNewMsgOpen(true);
            setComposeTo(mapped.phone);
            setComposeQuery(mapped.name);
            setComposeMessage(urlDraft);
          }
          return;
        }
        const contact = await fetchContactSummary(urlContactId);
        if (!contact || cancelled) return;
        setNewMsgOpen(true);
        setComposeTo(contact.phone);
        setComposeQuery(contact.name);
        if (urlDraft) setComposeMessage(urlDraft);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [urlContactId, ctx, urlDraft, mapConvo]);

  useEffect(() => {
    if (urlDraft && !urlContactId) {
      setNewMsgOpen(true);
      setComposeMessage(urlDraft);
    }
  }, [urlDraft, urlContactId]);

  useEffect(() => {
    if (!urlConversation) return;
    setSelectedId(urlConversation);
    let cancelled = false;
    void fetchConversation(urlConversation)
      .then((data) => {
        if (cancelled) return;
        const mapped = mapConvo(data);
        setConvos((prev) => (prev.some((c) => c.id === mapped.id) ? prev : [mapped, ...prev]));
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open conversation");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [urlConversation, ctx, mapConvo]);

  const [composeQuery, setComposeQuery] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeMessage, setComposeMessage] = useState(urlDraft || "");
  const [composeContacts, setComposeContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [composeSending, setComposeSending] = useState(false);
  const [composeNumberId, setComposeNumberId] = useState("");
  const [phoneNumbers, setPhoneNumbers] = useState<Array<{ id: string; number: string; label?: string }>>([]);

  useEffect(() => {
    if (!newMsgOpen) return;
    fetch("/api/numbers")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const rows = (json?.data || []) as Array<{ id: string; number: string; label?: string }>;
        setPhoneNumbers(rows);
        setComposeNumberId((prev) => prev || rows[0]?.id || "");
      })
      .catch(() => undefined);
  }, [newMsgOpen]);

  const reloadList = useCallback(async () => {
    try {
      const rows = await fetchInboxList(inboxQueryFromFilter(sel, productFilter));
      setConvos((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        return rows.map((r) => {
          const mapped = mapRow(r);
          const existing = prevById.get(mapped.id);
          if (existing?.messages.length) {
            return { ...mapped, messages: existing.messages };
          }
          return mapped;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations");
    }
  }, [sel, ctx, tags, tagDefinitions, productFilter, mapRow]);

  useEffect(() => {
    if (skipInitialReload.current) {
      skipInitialReload.current = false;
      return;
    }
    void reloadList();
  }, [reloadList]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetchConversation(selectedId)
      .then((data) => {
        if (cancelled) return;
        const mapped = mapConvo(data);
        setConvos((prev) => prev.map((c) => (c.id === selectedId ? mapped : c)));
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
  }, [selectedId, ctx, mapConvo]);

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
      const needle = searchQuery.trim().toLowerCase();
      return convos.filter((c) => {
        if (needle) {
          const haystack = `${c.name} ${c.phone} ${c.preview}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
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
    },
    [convos, sel, searchQuery],
  );

  useEffect(() => {
    if (!selectedId) return;
    if (filtered.some((c) => c.id === selectedId)) return;
    if (convos.some((c) => c.id === selectedId)) return;
    setSelectedId(null);
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

  const update = useCallback(
    async (next: Conversation) => {
      const prev = convos.find((c) => c.id === next.id);
      if (!prev) return;
      setConvos((p) =>
        p.map((x) =>
          x.id === next.id ? { ...next, unread: selectedId === next.id ? false : next.unread } : x,
        ),
      );
      try {
        const data = await syncConversationUpdate(prev, next, ctx, tags);
        if (data) {
          const mapped = mapConvo(data);
          setConvos((p) => p.map((x) => (x.id === next.id ? mapped : x)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update conversation");
        setConvos((p) => p.map((x) => (x.id === prev.id ? prev : x)));
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
    try {
      await Promise.all(
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk action failed");
    }
    setChecked(new Set());
    void reloadList();
  };

  const syncUrl = useCallback(
    (nextSel: FilterSel, opts?: { conversationId?: string | null; clearConversation?: boolean }) => {
      const params = filterSelToSearchParams(nextSel, searchParams);
      if (productFilter && productFilter !== "all") params.set("product", productFilter);
      else params.delete("product");
      if (opts?.clearConversation) params.delete("conversation");
      else if (opts?.conversationId) params.set("conversation", opts.conversationId);
      const suffix = params.toString();
      router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
    },
    [router, searchParams, productFilter],
  );

  const pickConvo = (c: Conversation) => {
    setSelectedId(c.id);
    syncUrl(sel, { conversationId: c.id });
    if (c.unread) {
      setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: false } : x)));
      void patchConversation(c.id, { unread: false }).catch(() => undefined);
    }
  };

  const handleComposeSend = async () => {
    if (!composeTo.trim() || !composeMessage.trim()) return;
    setComposeSending(true);
    setError("");
    const to = composeTo.trim();
    const message = composeMessage.trim();
    try {
      await sendNewMessage({ to, message, numberId: composeNumberId || undefined });
      setNewMsgOpen(false);
      setComposeTo("");
      setComposeMessage("");
      setComposeQuery("");
      const rows = await fetchInboxList(inboxQueryFromFilter(sel, productFilter));
      const mapped = rows.map((r) => mapRow(r));
      setConvos((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        return mapped.map((m) => {
          const existing = prevById.get(m.id);
          return existing?.messages.length ? { ...m, messages: existing.messages } : m;
        });
      });
      const normalized = to.replace(/\D/g, "");
      const match = mapped.find((c) => c.phone.replace(/\D/g, "") === normalized);
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
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not delete tag"));
          }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--tv-border)", background: "#fff" }}>
            <InboxProductFilters basePath="/conversations" />
          </div>
          <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <InboxRail
            sel={sel}
            onSel={(s) => {
              setSel(s);
              setSelectedId(null);
              setChecked(new Set());
              syncUrl(s, { clearConversation: true });
            }}
            counts={counts}
            tags={tags}
            teammates={teammates}
            onNew={() => canStartConversations && setNewMsgOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onOpenSettings={() => { setSettingsReturn("inbox"); setView("inboxSettings"); }}
          />
          <ConversationList
            title={title}
            subtitle={subtitle}
            convos={filtered}
            selectedId={selectedId}
            onSelect={pickConvo}
            checked={checked}
            onCheck={toggleCheck}
            allChecked={filtered.length > 0 && filtered.every((c) => checked.has(c.id))}
            onCheckAll={checkAll}
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
                contactOpen={contactOpen}
                onToggleContact={() => setContactOpen(!contactOpen)}
                onOpenTagsSettings={() => { setSettingsReturn("inbox"); setView("tags"); }}
                onDownloadTranscript={() => downloadTranscript(selected)}
                allowTagging={canTag}
              />
              {contactOpen && (
                <ConversationsContactPanel convo={selected} onClose={() => setContactOpen(false)} />
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
          onClick={() => setNewMsgOpen(false)}
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
                onClick={() => setNewMsgOpen(false)}
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
              value={composeQuery || composeTo}
              onChange={(e) => {
                setComposeQuery(e.target.value);
                setComposeTo(e.target.value);
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
              <button type="button" className="tv-btn-ghost" onClick={() => setNewMsgOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="tv-btn"
                disabled={composeSending || !composeTo.trim() || !composeMessage.trim()}
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
