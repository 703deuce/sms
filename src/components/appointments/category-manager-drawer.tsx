"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type CategoryRow = {
  id: string;
  name: string;
  description?: string | null;
  displayOrder?: number;
  serviceCount?: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCategoriesChange?: (categories: Array<{ id: string; name: string }>) => void;
  onSelectCategoryId?: (categoryId: string) => void;
};

export function CategoryManagerDrawer({
  open,
  onClose,
  onCategoriesChange,
  onSelectCategoryId,
}: Props) {
  const [items, setItems] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/categories");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load categories");
      const rows = (json.data || []) as CategoryRow[];
      setItems(rows);
      onCategoriesChange?.(rows.map((r) => ({ id: r.id, name: r.name })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [onCategoriesChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function createCategory() {
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          displayOrder: items.length,
          collapsible: true,
          collapsedByDefault: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Create failed");
      setNewName("");
      const created = json.data as CategoryRow;
      await load();
      if (created?.id) {
        onSelectCategoryId?.(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    const existing = items.find((item) => item.id === id);
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: string, serviceCount = 0) {
    if (serviceCount > 0) {
      const ok = window.confirm(
        `This category contains ${serviceCount} service(s). Archive it anyway? Services will keep their data but lose this category assignment when edited.`,
      );
      if (!ok) return;
    } else if (!window.confirm("Archive this category?")) {
      return;
    }
    const existing = items.find((item) => item.id === id);
    if (!existing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/service-booking/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: existing.name, active: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Archive failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="category-manager-title">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        aria-label="Close category manager"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 id="category-manager-title" className="text-base font-semibold text-[#1a1d29]">
              Manage categories
            </h2>
            <p className="mt-0.5 text-[12px] text-[#8a8fa3]">
              Group services on your public booking page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#8a8fa3] hover:bg-[#f7f8fa]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}

          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="New category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createCategory();
              }}
            />
            <Button size="sm" disabled={saving || !newName.trim()} onClick={() => void createCategory()}>
              Add
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-[#8a8fa3]">Loading categories…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[#8a8fa3]">No categories yet. Add one to group your services.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((cat) => (
                <li
                  key={cat.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[#ecedf2] px-3 py-2"
                >
                  {editingId === cat.id ? (
                    <div className="flex flex-1 gap-2">
                      <input
                        className="input flex-1"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveRename(cat.id);
                        }}
                      />
                      <Button size="sm" variant="secondary" disabled={saving} onClick={() => void saveRename(cat.id)}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[#1a1d29]">{cat.name}</p>
                        <p className="text-[11px] text-[#8a8fa3]">
                          {(cat.serviceCount ?? 0).toLocaleString()} service{(cat.serviceCount ?? 0) === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(cat.id);
                            setEditingName(cat.name);
                          }}
                        >
                          Rename
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          disabled={saving}
                          onClick={() => void deleteCategory(cat.id, cat.serviceCount ?? 0)}
                        >
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
