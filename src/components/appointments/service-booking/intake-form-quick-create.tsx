"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const INTAKE_API = "/api/appointments/service-booking/intake-forms";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (form: { id: string; name: string }) => void;
};

export function IntakeFormQuickCreate({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Form name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch(INTAKE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, fields: [], active: true }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not create intake form.");
      return;
    }
    const json = await res.json();
    const row = (json.data || { id: `form_${Date.now()}`, name: trimmed }) as { id: string; name: string };
    onCreated(row);
    setName("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="intake-quick-create-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="intake-quick-create-title" className="text-[15px] font-bold">Create intake form</h2>
          <button type="button" onClick={onClose} className="text-[#8a87a0] hover:text-[#1a1830]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="font-medium">Form name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="New client intake" />
          </label>
          <p className="text-[12px] text-[#8a87a0]">You can add fields after saving from Forms & Documents.</p>
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>
        <div className="border-t px-5 py-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="button" size="sm" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
