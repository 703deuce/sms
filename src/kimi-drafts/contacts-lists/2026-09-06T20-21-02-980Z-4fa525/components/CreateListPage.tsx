"use client";
import { useState } from "react";
import { ListPlus, Loader2 } from "lucide-react";

interface Props {
  onBack: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}

export default function CreateListPage({ onBack, onSave }: Props) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(trimmedName, desc.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create list");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[640px] pt-6">
      <div className="breadcrumb">Lists / <span>Create List</span></div>
      <h1 className="page-title"><ListPlus size={19} className="text-[#3b4ef5]" /> Create List</h1>
      <p className="page-subtitle mb-7">Create a new contact list.</p>

      <form className="form-card" onSubmit={handleSubmit}>
        <label className="field-label" htmlFor="list-name">List Name</label>
        <input id="list-name" className="input max-w-[420px]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nashville Store" required autoFocus />

        <label className="field-label mt-5" htmlFor="list-description">Description</label>
        <textarea id="list-description" className="input h-[110px] max-w-[420px] resize-none" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Customers of Nashville Location" />

        {error ? <p className="mt-4 text-[13px] text-rose-600" role="alert">{error}</p> : null}

        <div className="mt-6 flex gap-3 border-t border-[#f1f3f9] pt-5">
          <button type="submit" className="btn-primary" disabled={!name.trim() || saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="btn-secondary" onClick={onBack} disabled={saving}>Back</button>
        </div>
      </form>
    </div>
  );
}
