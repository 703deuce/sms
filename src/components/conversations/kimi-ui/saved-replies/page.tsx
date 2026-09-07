"use client";

import { useMemo, useState } from "react";
import "./reference.css";
import { SavedRepliesTable } from "./components/SavedRepliesTable";
import { ReplyEditorDrawer } from "./components/ReplyEditorDrawer";
import { DeleteReplyDialog } from "./components/DeleteReplyDialog";
import { savedReplies as seedReplies, replyCategories, type SavedReply } from "./types";
import { MessageSquarePlus, Search, ArrowLeft, Loader2, AlertCircle, Lock } from "lucide-react";

type EditorState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; reply: SavedReply };

export default function SavedRepliesPage() {
  const [replies, setReplies] = useState<SavedReply[]>(seedReplies);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sharing, setSharing] = useState<"all" | "team" | "private">("all");
  const [editor, setEditor] = useState<EditorState>({ mode: "closed" });
  const [deleteTarget, setDeleteTarget] = useState<SavedReply | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // demo state switcher (top-right, subtle)
  const [demoState, setDemoState] = useState<"normal" | "loading" | "error" | "empty" | "readonly">("normal");

  const readOnly = demoState === "readonly";

  const filtered = useMemo(() => {
    if (demoState === "empty") return [];
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
  }, [replies, query, category, sharing, demoState]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }

  function handleSave(reply: SavedReply) {
    setReplies((prev) => {
      const exists = prev.some((r) => r.id === reply.id);
      return exists ? prev.map((r) => (r.id === reply.id ? reply : r)) : [reply, ...prev];
    });
    setEditor({ mode: "closed" });
    showToast(editor.mode === "create" ? "Saved reply created." : "Saved reply updated.");
  }

  function handleDelete(id: string) {
    setReplies((prev) => prev.filter((r) => r.id !== id));
    setDeleteTarget(null);
    showToast("Saved reply deleted.");
  }

  return (
    <div className="sr-page">
      {/* breadcrumb / back — returns to Messages inbox (canonical parent) */}
      <a className="sr-back" href="/conversations">
        <ArrowLeft size={14} aria-hidden />
        Messages
      </a>

      <header className="sr-header">
        <div>
          <h1 className="sr-title">Saved replies</h1>
          <p className="sr-desc">
            Reusable conversation snippets your team can insert while replying to customers.
          </p>
        </div>
        <div className="sr-header-actions">
          {/* demo state control — remove on integration */}
          <select
            className="sr-demo-select"
            value={demoState}
            onChange={(e) => setDemoState(e.target.value as typeof demoState)}
            aria-label="Demo state"
          >
            <option value="normal">Normal</option>
            <option value="loading">Loading</option>
            <option value="error">Error</option>
            <option value="empty">First-use empty</option>
            <option value="readonly">Read-only</option>
          </select>
          <button
            className="sr-btn sr-btn-primary"
            onClick={() => setEditor({ mode: "create" })}
            disabled={readOnly}
            title={readOnly ? "You have read-only access" : undefined}
          >
            <MessageSquarePlus size={15} aria-hidden />
            New saved reply
          </button>
        </div>
      </header>

      {readOnly && (
        <div className="sr-banner" role="status">
          <Lock size={14} aria-hidden />
          You have read-only access to saved replies. Contact an administrator to make changes.
        </div>
      )}

      {/* control bar */}
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
        <select
          className="sr-select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {replyCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="sr-select"
          value={sharing}
          onChange={(e) => setSharing(e.target.value as typeof sharing)}
          aria-label="Filter by sharing"
        >
          <option value="all">Team + private</option>
          <option value="team">Shared with team</option>
          <option value="private">Private only</option>
        </select>
        {demoState === "normal" && (
          <span className="sr-count">
            {filtered.length} {filtered.length === 1 ? "reply" : "replies"}
          </span>
        )}
      </div>

      {/* content */}
      {demoState === "loading" ? (
        <div className="sr-table-shell" aria-busy="true" aria-label="Loading saved replies">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="sr-skel-row">
              <div className="sr-skel sr-skel-w140" />
              <div className="sr-skel sr-skel-w80" />
              <div className="sr-skel sr-skel-grow" />
              <div className="sr-skel sr-skel-w60" />
            </div>
          ))}
        </div>
      ) : demoState === "error" ? (
        <div className="sr-state-card" role="alert">
          <AlertCircle size={20} className="sr-state-icon sr-state-icon-danger" aria-hidden />
          <h2 className="sr-state-title">Saved replies couldn’t be loaded</h2>
          <p className="sr-state-desc">
            Something went wrong while loading your team’s replies. Your existing replies are safe.
          </p>
          <button className="sr-btn sr-btn-outline" onClick={() => setDemoState("normal")}>
            <Loader2 size={14} aria-hidden />
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        query || category !== "all" || sharing !== "all" ? (
          <div className="sr-state-card">
            <Search size={20} className="sr-state-icon" aria-hidden />
            <h2 className="sr-state-title">No replies match your filters</h2>
            <p className="sr-state-desc">Try a different search term or clear the filters.</p>
            <button
              className="sr-btn sr-btn-outline"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setSharing("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="sr-state-card">
            <MessageSquarePlus size={20} className="sr-state-icon" aria-hidden />
            <h2 className="sr-state-title">No saved replies yet</h2>
            <p className="sr-state-desc">
              Create saved replies for common questions like estimates, scheduling, and follow-ups.
              Anyone on your team can insert them while replying to customers.
            </p>
            {!readOnly && (
              <button className="sr-btn sr-btn-primary" onClick={() => setEditor({ mode: "create" })}>
                <MessageSquarePlus size={15} aria-hidden />
                Create saved reply
              </button>
            )}
          </div>
        )
      ) : (
        <SavedRepliesTable
          replies={filtered}
          readOnly={readOnly}
          onEdit={(r) => setEditor({ mode: "edit", reply: r })}
          onDelete={(r) => setDeleteTarget(r)}
        />
      )}

      {/* editor drawer */}
      {editor.mode !== "closed" && (
        <ReplyEditorDrawer
          key={editor.mode === "edit" ? editor.reply.id : "new"}
          initial={editor.mode === "edit" ? editor.reply : null}
          categories={replyCategories}
          onClose={() => setEditor({ mode: "closed" })}
          onSave={handleSave}
        />
      )}

      {/* delete confirm */}
      {deleteTarget && (
        <DeleteReplyDialog
          reply={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget.id)}
        />
      )}

      {/* toast */}
      {toast && (
        <div className="sr-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
