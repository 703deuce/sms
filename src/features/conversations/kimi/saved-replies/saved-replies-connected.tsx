"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import "@/components/conversations/kimi-ui/saved-replies/reference.css";
import { SavedRepliesTable } from "@/components/conversations/kimi-ui/saved-replies/components/SavedRepliesTable";
import { ReplyEditorDrawer } from "@/components/conversations/kimi-ui/saved-replies/components/ReplyEditorDrawer";
import { DeleteReplyDialog } from "@/components/conversations/kimi-ui/saved-replies/components/DeleteReplyDialog";
import { replyCategories, type SavedReply } from "@/components/conversations/kimi-ui/saved-replies/types";
import { MessageSquarePlus, Search, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; reply: SavedReply };

function mapTemplate(row: {
  id: string;
  name: string;
  category: string;
  body: string;
  tags?: string[];
  shared?: boolean;
  updatedAt?: string;
}): SavedReply {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    body: row.body,
    tags: row.tags || [],
    shared: row.shared ?? true,
    createdBy: "Team",
    updatedAt: row.updatedAt || "",
  };
}

export function SavedRepliesConnected() {
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sharing, setSharing] = useState<"all" | "team" | "private">("all");
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<SavedReply | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/api/templates")
      .then((r) => r.json())
      .then((json) => {
        const inbox = (json.data || []).filter(
          (t: { type?: string }) => t.type === "Inbox reply",
        );
        setReplies(inbox.map(mapTemplate));
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return replies.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (sharing === "team" && !r.shared) return false;
      if (sharing === "private" && r.shared) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.body.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [replies, query, category, sharing]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  async function handleSave(reply: SavedReply) {
    const isEdit = editor.mode === "edit";
    const res = await fetch("/api/templates", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isEdit ? { id: reply.id } : {}),
        name: reply.name,
        category: reply.category,
        type: "Inbox reply",
        channel: "SMS",
        body: reply.body,
        shared: reply.shared,
        tags: reply.tags,
      }),
    });
    if (!res.ok) {
      showToast("Could not save reply.");
      return;
    }
    setEditor({ mode: "closed" });
    showToast(isEdit ? "Saved reply updated." : "Saved reply created.");
    load();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setDeleteTarget(null);
    showToast("Saved reply deleted.");
    load();
  }

  return (
    <div className="sr-page">
      <Link className="sr-back" href="/conversations">
        <ArrowLeft size={14} aria-hidden />
        Messages
      </Link>

      <header className="sr-header">
        <div>
          <h1 className="sr-title">Saved replies</h1>
          <p className="sr-desc">
            Reusable conversation snippets your team can insert while replying to customers.
          </p>
        </div>
        <div className="sr-header-actions">
          <button className="sr-btn sr-btn-primary" onClick={() => setEditor({ mode: "create" })}>
            <MessageSquarePlus size={15} aria-hidden />
            New saved reply
          </button>
        </div>
      </header>

      <div className="sr-controls">
        <div className="sr-search">
          <Search size={14} aria-hidden className="sr-search-icon" />
          <input
            type="search"
            placeholder="Search replies, content, or tags…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search saved replies"
          />
        </div>
        <select className="sr-select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {replyCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="sr-select"
          value={sharing}
          onChange={(e) => setSharing(e.target.value as typeof sharing)}
        >
          <option value="all">Team + private</option>
          <option value="team">Shared with team</option>
          <option value="private">Private only</option>
        </select>
        {!loading && <span className="sr-count">{filtered.length} replies</span>}
      </div>

      {loading ? (
        <div className="sr-table-shell" aria-busy="true">
          <Loader2 className="animate-spin" size={20} />
        </div>
      ) : error ? (
        <div className="sr-state-card" role="alert">
          <AlertCircle size={20} className="sr-state-icon sr-state-icon-danger" />
          <h2 className="sr-state-title">Saved replies couldn&apos;t be loaded</h2>
          <button className="sr-btn sr-btn-outline" onClick={load}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="sr-state-card">
          <MessageSquarePlus size={20} className="sr-state-icon" />
          <h2 className="sr-state-title">No saved replies yet</h2>
          <button className="sr-btn sr-btn-primary" onClick={() => setEditor({ mode: "create" })}>
            Create saved reply
          </button>
        </div>
      ) : (
        <SavedRepliesTable
          replies={filtered}
          readOnly={false}
          onEdit={(r) => setEditor({ mode: "edit", reply: r })}
          onDelete={(r) => setDeleteTarget(r)}
        />
      )}

      {editor.mode !== "closed" && (
        <ReplyEditorDrawer
          key={editor.mode === "edit" ? editor.reply.id : "new"}
          initial={editor.mode === "edit" ? editor.reply : null}
          categories={replyCategories}
          onClose={() => setEditor({ mode: "closed" })}
          onSave={handleSave}
        />
      )}

      {deleteTarget && (
        <DeleteReplyDialog
          reply={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}

      {toast && <div className="sr-toast" role="status">{toast}</div>}
    </div>
  );
}
