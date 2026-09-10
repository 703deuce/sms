"use client";

import { useEffect, useState } from "react";

export type ContactOption = { id: string; name: string; phone: string };

export function ContactSearchField({
  selected,
  onSelect,
  label = "Customer",
}: {
  selected: ContactOption | null;
  onSelect: (contact: ContactOption | null) => void;
  label?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ContactOption[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ take: "12", q });
      void fetch(`/api/contacts?${params}`)
        .then((r) => r.json())
        .then((json) => {
          setOptions(
            (json.data || []).map((c: { id: string; firstName?: string; lastName?: string; phone: string }) => ({
              id: c.id,
              name: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone,
              phone: c.phone,
            })),
          );
        })
        .catch(() => setOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative">
      <label className="flex flex-col gap-1 text-sm">
        <span>{label}</span>
        <input
          className="rounded-md border border-input bg-background px-3 py-2"
          value={selected ? selected.name : query}
          onChange={(e) => {
            onSelect(null);
            setQuery(e.target.value);
          }}
          placeholder="Search by name or phone"
          autoComplete="off"
        />
      </label>
      {selected ? (
        <button
          type="button"
          className="mt-1 text-xs text-muted-foreground underline"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
        >
          Clear selection
        </button>
      ) : null}
      {!selected && options.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-background shadow-md">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(opt);
                  setQuery(opt.name);
                  setOptions([]);
                }}
              >
                <span className="font-medium">{opt.name}</span>
                <span className="block text-xs text-muted-foreground">{opt.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
