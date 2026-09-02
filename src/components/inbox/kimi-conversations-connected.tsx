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
import ThreadView from "@/components/kimi/conversations/components/ThreadView";
import BulkActionsBar from "@/components/kimi/conversations/components/BulkActionsBar";
import TagsSettings from "@/components/kimi/conversations/components/TagsSettings";
import SettingsHome from "@/components/kimi/conversations/components/SettingsHome";
import InboxSettings from "@/components/kimi/conversations/components/InboxSettings";
import type { Conversation, Tag } from "@/components/kimi/conversations/mock-data";
import { ConversationsContactPanel } from "@/components/inbox/conversations-contact-panel";
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
  patchConversation,
  resolveAssigneeApiId,
  searchContacts,
  sendNewMessage,
  syncConversationUpdate,
  type KimiInboxContext,
} from "@/lib/inbox/kimi-inbox-adapter";
import {
  fetchMessagingRuntimeSettings,
  inboxTagsFromSettings,
  persistInboxTag,
} from "@/lib/auto-replies/kimi-messaging-settings-adapter";

type View = "inbox" | "settings" | "inboxSettings" | "tags";

function filterFromUrlParam(filter: string | null): FilterSel | null {
  switch (filter) {
    case "mine":
      return { kind: "mine", key: "all" };
    case "unread":
      return { kind: "all", key: "unread" };
    case "unassigned":
      return { kind: "all", key: "unassigned" };
    case "archived":
    case "closed":
      return { kind: "all", key: "closed" };
    case "open":
      return { kind: "all", key: "open" };
    case "pending":
      return { kind: "all", key: "pending" };
    default:
      return null;
  }
}

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
  const urlFilter = searchParams.get("filter");
  const urlUnread = searchParams.get("unread");
  const urlConversation = searchParams.get("conversation") || initialConversationId;
  const urlContactId =
    searchParams.get("contactId") ||
    searchParams.get("contact") ||
    initialContactId;
  const urlDraft = searchParams.get("draft")
    ? decodeURIComponent(searchParams.get("draft")!)
    : initialDraft;

  const ctx = useMemo<KimiInboxContext>(
    () => ({ currentUserId, currentUserName, teamMembers }),
    [currentUserId, currentUserName, teamMembers],
  );

  const initialSel = useMemo((): FilterSel => {
    if (urlUnread === "1") return { kind: "all", key: "unread" };
    return filterFromUrlParam(urlFilter) ?? { kind: "mine", key: "all" };
  }, [urlFilter, urlUnread]);

  const teammates = useMemo(() => buildTeammates(ctx), [ctx]);

  const [convos, setConvos] = useState<Conversation[]>(() =>
    initialConversations.map((c) => mapApiConversationToKimi(c, ctx)),
  );
  const [extraTags, setExtraTags] = useState<Tag[]>([]);
  const [persistedTags, setPersistedTags] = useState<Tag[]>([]);

  useEffect(() => {
    void fetchMessagingRuntimeSettings()
      .then((s) => setPersistedTags(inboxTagDefinitionsToKimi(inboxTagsFromSettings(s.inboxTagsJson))))
      .catch(() => undefined);
  }, []);

  const tags = useMemo(() => {
    const fromConvos = buildTagsFromConversations(convos);
    const fromPersisted = persistedTags;
    const fromExtra = extraTags;
    const byId = new Map<string, Tag>();
    for (const t of [...fromPersisted, ...fromConvos, ...fromExtra]) {
      byId.set(t.id, t);
    }
    return Array.from(byId.values());
  }, [convos, extraTags, persistedTags]);
  const [sel, setSel] = useState<FilterSel>(initialSel);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => urlConversation || initialConversations[0]?.id || null,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [contactOpen, setContactOpen] = useState(false);
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [view, setView] = useState<View>("inbox");
  const [error, setError] = useState("");
  const skipInitialReload = useRef(!urlFilter && urlUnread !== "1");

  useEffect(() => {
    setSel(initialSel);
  }, [initialSel]);

  useEffect(() => {
    if (!urlContactId) return;
    let cancelled = false;
    void fetchConversationForContact(urlContactId)
      .then(async (data) => {
        if (cancelled) return;
        if (data) {
          const mapped = mapApiConversationToKimi(data, ctx);
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
  }, [urlContactId, ctx, urlDraft]);

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
        const mapped = mapApiConversationToKimi(data, ctx);
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
  }, [urlConversation, ctx]);

  const [composeQuery, setComposeQuery] = useState("");
  const [composeTo, setComposeTo] = useState("");
  const [composeMessage, setComposeMessage] = useState(urlDraft || "");
  const [composeContacts, setComposeContacts] = useState<Array<{ id: string; name: string; phone: string }>>([]);
  const [composeSending, setComposeSending] = useState(false);

  const reloadList = useCallback(async () => {
    try {
      const rows = await fetchInboxList(inboxQueryFromFilter(sel));
      setConvos((prev) => {
        const prevById = new Map(prev.map((c) => [c.id, c]));
        return rows.map((r) => {
          const mapped = mapListItemToKimi(r, ctx);
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
  }, [sel, ctx]);

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
        const mapped = mapApiConversationToKimi(data, ctx);
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
  }, [selectedId, ctx]);

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
        const data = await syncConversationUpdate(prev, next, ctx);
        if (data) {
          const mapped = mapApiConversationToKimi(data, ctx);
          setConvos((p) => p.map((x) => (x.id === next.id ? mapped : x)));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update conversation");
        setConvos((p) => p.map((x) => (x.id === prev.id ? prev : x)));
      }
    },
    [convos, ctx, selectedId],
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
            const mapped = mapApiConversationToKimi(data, ctx);
            setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
            return;
          }
          if (kind === "assign") {
            const data = await patchConversation(id, {
              assigneeId: resolveAssigneeApiId(val || null, ctx),
            });
            const mapped = mapApiConversationToKimi(data, ctx);
            setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
            return;
          }
          if (kind === "tag") {
            const row = convos.find((c) => c.id === id);
            if (!row) return;
            const next = val === "clear" ? [] : Array.from(new Set([...row.tags, val]));
            const data = await patchConversation(id, { tags: next });
            const mapped = mapApiConversationToKimi(data, ctx);
            setConvos((p) => p.map((c) => (c.id === id ? mapped : c)));
            return;
          }
          if (kind === "mark") {
            const data = await patchConversation(id, { unread: val === "unread" });
            const mapped = mapApiConversationToKimi(data, ctx);
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

  const pickConvo = (c: Conversation) => {
    setSelectedId(c.id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", c.id);
    router.replace(`/conversations?${params.toString()}`, { scroll: false });
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
      await sendNewMessage({ to, message });
      setNewMsgOpen(false);
      setComposeTo("");
      setComposeMessage("");
      setComposeQuery("");
      const rows = await fetchInboxList(inboxQueryFromFilter(sel));
      const mapped = rows.map((r) => mapListItemToKimi(r, ctx));
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
        const params = new URLSearchParams(searchParams.toString());
        params.set("conversation", match.id);
        router.replace(`/conversations?${params.toString()}`, { scroll: false });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send message");
    } finally {
      setComposeSending(false);
    }
  };

  return (
    <div className="ref-scope">
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
          }}
        >
          {error}
        </div>
      ) : null}

      {view === "settings" ? (
        <SettingsHome onOpenInbox={() => setView("inboxSettings")} />
      ) : view === "inboxSettings" ? (
        <InboxSettings onBack={() => setView("settings")} onOpenTags={() => setView("tags")} />
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
                setPersistedTags(inboxTagDefinitionsToKimi(rows));
              })
              .catch((err) => setError(err instanceof Error ? err.message : "Could not save tag"));
          }}
        />
      ) : (
        <>
          <InboxRail
            sel={sel}
            onSel={(s) => {
              setSel(s);
              setSelectedId(null);
              setChecked(new Set());
              const params = new URLSearchParams();
              if (s.kind === "mine" && s.key === "all") params.set("filter", "mine");
              else if (s.kind === "all" && s.key === "unassigned") params.set("filter", "unassigned");
              else if (s.kind === "all" && s.key === "unread") params.set("filter", "unread");
              else if (s.kind === "all" && s.key === "open") params.set("filter", "open");
              else if (s.kind === "all" && s.key === "pending") params.set("filter", "pending");
              else if (s.kind === "all" && s.key === "closed") params.set("filter", "closed");
              else if (s.kind === "mine" && s.key === "unread") {
                params.set("filter", "mine");
                params.set("unread", "1");
              }
              const suffix = params.toString();
              router.replace(suffix ? `/conversations?${suffix}` : "/conversations", { scroll: false });
            }}
            counts={counts}
            tags={tags}
            teammates={teammates}
            onNew={() => setNewMsgOpen(true)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
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
            <BulkActionsBar count={checked.size} onAction={(a) => void bulk(a)} tags={tags} teammates={teammates} />
          ) : selected ? (
            <>
              <ThreadView
                convo={selected}
                tags={tags}
                teammates={teammates}
                onUpdate={(c) => void update(c)}
                contactOpen={contactOpen}
                onToggleContact={() => setContactOpen(!contactOpen)}
                onOpenTagsSettings={() => setView("tags")}
                onDownloadTranscript={() => downloadTranscript(selected)}
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
              <button type="button" className="tv-btn" onClick={() => setNewMsgOpen(true)}>
                <MessageSquarePlus size={14} /> New Message
              </button>
              <button
                type="button"
                onClick={() => setView("tags")}
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
        </>
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
