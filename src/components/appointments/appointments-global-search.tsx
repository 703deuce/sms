"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type SearchResult = {
  kind: string;
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
};

export function AppointmentsGlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/appointments/service-booking/global-search?q=${encodeURIComponent(q)}&limit=12`,
      );
      const json = await res.json();
      if (res.ok) setResults(json.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <label htmlFor="appt-global-search" className="sr-only">Search appointments platform</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          id="appt-global-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search appointments, customers, services…"
          className="h-9 w-full rounded-md border bg-background pl-9 pr-3 text-sm"
          autoComplete="off"
        />
      </div>
      {open && query.trim() ? (
        <ul
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
          role="listbox"
          aria-label="Search results"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results</li>
          ) : (
            results.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <button
                  type="button"
                  role="option"
                  className="flex w-full flex-col rounded px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    if (row.href) router.push(row.href);
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  <span className="font-medium">{row.title}</span>
                  {row.subtitle ? (
                    <span className="text-xs text-muted-foreground">{row.subtitle}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
