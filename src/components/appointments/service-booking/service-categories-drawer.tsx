"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const CATEGORIES_API = "/api/appointments/service-booking/categories";

type CategoryRow = {
  id: string;
  name: string;
  slug?: string;
  displayOrder?: number;
  active?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onCreated?: (category: { id: string; name: string }) => void;
};

export function ServiceCategoriesDrawer({ open, onClose, onChanged, onCreated }: Props) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(CATEGORIES_API);
    const json = await res.json();
    setCategories(json.data || []);
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    const res = await fetch(CATEGORIES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, displayOrder: categories.length, collapsible: true }),
    });
    setSaving(false);
    setNewName("");
    await load();
    if (res.ok) {
      const json = await res.json();
      const created = json.data as { id: string; name: string } | undefined;
      if (created?.id) onCreated?.(created);
    }
    onChanged?.();
  }

  async function saveRename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    const row = categories.find((c) => c.id === id);
    await fetch(CATEGORIES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, displayOrder: row?.displayOrder ?? 0 }),
    });
    setSaving(false);
    setEditingId(null);
    await load();
    onChanged?.();
  }

  async function toggleActive(row: CategoryRow) {
    setSaving(true);
    await fetch(CATEGORIES_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id, name: row.name, active: !row.active }),
    });
    setSaving(false);
    await load();
    onChanged?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="categories-drawer-title">
      <button type="button" className="absolute inset-0 bg-black/30" aria-label="Close" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 id="categories-drawer-title" className="text-[15px] font-bold">Manage categories</h2>
          <button type="button" onClick={onClose} className="text-[#8a87a0] hover:text-[#1a1830]">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2">
            <input
              className="input flex-1 text-[13px]"
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Button size="sm" disabled={saving || !newName.trim()} onClick={() => void createCategory()}>
              Add
            </Button>
          </div>
          <ul className="divide-y border rounded-lg">
            {categories.length === 0 ? (
              <li className="p-4 text-[13px] text-[#8a87a0]">No categories yet.</li>
            ) : (
              categories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between gap-2 p-3 text-[13px]">
                  {editingId === cat.id ? (
                    <>
                      <input
                        className="input flex-1 text-[13px]"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                      <Button size="sm" variant="outline" onClick={() => void saveRename(cat.id)}>Save</Button>
                    </>
                  ) : (
                    <>
                      <span className={cat.active === false ? "text-[#8a87a0]" : "font-medium"}>
                        {cat.name}
                        {cat.active === false ? " (inactive)" : ""}
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="text-[12px] text-[#5b4bff] hover:underline"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditName(cat.name);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="text-[12px] text-[#6b6880] hover:underline"
                          onClick={() => void toggleActive(cat)}
                        >
                          {cat.active === false ? "Activate" : "Deactivate"}
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
