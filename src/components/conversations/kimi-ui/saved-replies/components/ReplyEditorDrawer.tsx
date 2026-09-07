"use client";

import { useEffect, useState } from "react";
import type { SavedReply } from "../types";
import { X, Variable, Info } from "lucide-react";

const VARIABLES = ["first_name", "business_name", "appointment_date", "appointment_time"];

export function ReplyEditorDrawer({
  initial,
  categories,
  onClose,
  onSave,
}: {
  initial: SavedReply | null;
  categories: string[];
  onClose: () => void;
  onSave: (r: SavedReply) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? categories[0]);
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState((initial?.tags ?? []).join(", "));
  const [shared, setShared] = useState(initial?.shared ?? true);
  const [errors, setErrors] = useState<{ name?: string; body?: string }>({});

  // Escape closes the drawer (temporary UI convention)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function insertVariable(v: string) {
    setBody((b) => (b ? `${b} {{${v}}}` : `{{${v}}}`));
  }

  function submit() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = "Enter a name for this reply.";
    if (!body.trim()) next.body = "Enter the reply content.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSave({
      id: initial?.id ?? `sr-${Date.now()}`,
      name: name.trim(),
      category,
      body: body.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      shared,
      createdBy: initial?.createdBy ?? "You",
      updatedAt: "Just now",
    });
  }

  return (
    <div className="sr-drawer-overlay" onClick={onClose}>
      <aside
        className="sr-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit saved reply" : "New saved reply"}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sr-drawer-header">
          <h2 className="sr-drawer-title">{initial ? "Edit saved reply" : "New saved reply"}</h2>
          <button className="sr-iconbtn" onClick={onClose} aria-label="Close editor">
            <X size={16} aria-hidden />
          </button>
        </header>

        <div className="sr-drawer-body">
          <div className="sr-field">
            <label className="sr-label" htmlFor="sr-name">
              Name
            </label>
            <input
              id="sr-name"
              className={`sr-input ${errors.name ? "sr-input-error" : ""}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Estimate follow-up"
              autoFocus
            />
            {errors.name && <p className="sr-error">{errors.name}</p>}
          </div>

          <div className="sr-field">
            <label className="sr-label" htmlFor="sr-category">
              Category
            </label>
            <select
              id="sr-category"
              className="sr-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="sr-field">
            <div className="sr-label-row">
              <label className="sr-label" htmlFor="sr-body">
                Reply content
              </label>
              <span className="sr-charcount">{body.length}/918</span>
            </div>
            <textarea
              id="sr-body"
              className={`sr-input sr-textarea ${errors.body ? "sr-input-error" : ""}`}
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 918))}
              placeholder="Hi {{first_name}}, thanks for reaching out…"
              rows={7}
            />
            {errors.body && <p className="sr-error">{errors.body}</p>}
            <div className="sr-var-row">
              <Variable size={13} aria-hidden className="sr-muted-icon" />
              <span className="sr-var-hint">Insert:</span>
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="sr-var-chip"
                  onClick={() => insertVariable(v)}
                >
                  {`{{${v}}}`}
                </button>
              ))}
            </div>
          </div>

          <div className="sr-field">
            <label className="sr-label" htmlFor="sr-tags">
              Tags <span className="sr-label-opt">— optional, comma separated</span>
            </label>
            <input
              id="sr-tags"
              className="sr-input"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="estimate, follow-up"
            />
          </div>

          <div className="sr-share-row">
            <div>
              <div className="sr-label">Share with team</div>
              <p className="sr-share-desc">
                Shared replies can be inserted by anyone on your team. Private replies are only
                visible to you.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={shared}
              className={`sr-switch ${shared ? "sr-switch-on" : ""}`}
              onClick={() => setShared((s) => !s)}
              aria-label="Share with team"
            >
              <span className="sr-switch-thumb" />
            </button>
          </div>

          <div className="sr-note">
            <Info size={13} aria-hidden />
            Saved replies are inserted into the composer in Messages. They never send
            automatically.
          </div>
        </div>

        <footer className="sr-drawer-footer">
          <button className="sr-btn sr-btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="sr-btn sr-btn-primary" onClick={submit}>
            {initial ? "Save changes" : "Create reply"}
          </button>
        </footer>
      </aside>
    </div>
  );
}
