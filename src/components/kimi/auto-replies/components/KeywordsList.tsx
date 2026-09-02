import { useEffect, useState } from "react";
import { Search, Plus, MoreVertical, Pencil, QrCode, Link2, Trash2, ListChecks } from "lucide-react";
import { keywords as seedKeywords, Keyword } from "../mock-data";
import { AutoReplySubScreen } from "./AutoReplySubScreen";
import { V1EmptyState } from "@/components/v1/v1-polish";

const newKeyword = (): Keyword => ({
  id: "new",
  keyword: "",
  lastSaved: "Never saved",
  description: "",
  connectedLists: 0,
  createsContacts: true,
  autoResponse: "Thanks for subscribing to Transovo text alerts.",
});

export default function KeywordsList({
  keywords: keywordsProp,
  onEdit,
  onBack,
}: {
  keywords?: Keyword[];
  onEdit: (k: Keyword) => void;
  onBack: () => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(keywordsProp !== undefined ? keywordsProp : seedKeywords);

  useEffect(() => {
    if (keywordsProp !== undefined) setItems(keywordsProp);
  }, [keywordsProp]);

  const rows = items.filter((k) => k.keyword.toLowerCase().includes(query.toLowerCase()));

  return (
    <div onClick={() => menuFor && setMenuFor(null)}>
      <AutoReplySubScreen
        emoji="🏷️"
        title="Keywords"
        description="View and manage keywords. Each keyword can override the default opt-in auto-response."
        breadcrumb={[{ label: "Keywords" }]}
        onBack={onBack}
        hideFooter
        headerActions={
          <button
            type="button"
            onClick={() => onEdit(newKeyword())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all duration-150 hover:bg-primary-hover active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Plus size={15} /> Create Keyword
          </button>
        }
      >
        <div className="mb-4 flex justify-end">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
            />
            <input
              className="h-9 w-60 rounded-lg border border-border bg-card pl-9 pr-3 text-[13px] outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
              placeholder="Search keywords…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {rows.length === 0 ? (
          <V1EmptyState
            emoji="🏷️"
            title="No keywords yet"
            description="Create a text-to-join keyword to capture subscribers with custom auto-replies."
            action={
              <button
                type="button"
                onClick={() => onEdit(newKeyword())}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98]"
              >
                <Plus size={15} /> Create Keyword
              </button>
            }
          />
        ) : (
          <div className="surface overflow-visible rounded-xl bg-card">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left">
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Keyword
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Lists
                  </th>
                  <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Creates Contacts
                  </th>
                  <th className="w-12 px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => onEdit(k)}
                        className="text-left font-semibold text-foreground transition-colors hover:text-primary"
                      >
                        {k.keyword || "(untitled)"}
                      </button>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        Last saved on {k.lastSaved}
                      </div>
                    </td>
                    <td className="max-w-[280px] px-4 py-3.5 text-muted-foreground">
                      {k.description}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground ring-1 ring-border/60">
                        <ListChecks size={12} />
                        {k.connectedLists} Connected List{k.connectedLists === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {k.createsContacts && (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                          Yes
                        </span>
                      )}
                    </td>
                    <td className="relative px-4 py-3.5">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === k.id ? null : k.id);
                        }}
                      >
                        <MoreVertical size={16} />
                      </button>
                      {menuFor === k.id && (
                        <div
                          className="absolute right-4 top-10 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card py-1.5 shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                            onClick={() => {
                              setMenuFor(null);
                              onEdit(k);
                            }}
                          >
                            <Pencil size={14} className="text-muted-foreground" /> Edit
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <QrCode size={14} className="text-muted-foreground" /> Create QR Code
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
                          >
                            <Link2 size={14} className="text-muted-foreground" /> Create Tap-to-Join Link
                          </button>
                          <div className="my-1 border-t border-border/70" />
                          <button
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium text-danger transition-colors hover:bg-danger/10"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <select className="h-9 w-32 rounded-lg border border-border bg-card px-2.5 text-[13px] text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            ← Back
          </button>
        </div>
      </AutoReplySubScreen>
    </div>
  );
}
