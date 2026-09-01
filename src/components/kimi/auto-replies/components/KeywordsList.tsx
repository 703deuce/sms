import { useEffect, useState } from "react";
import { Search, Plus, MoreVertical, Pencil, QrCode, Link2, Trash2, ListChecks } from "lucide-react";
import { keywords as seedKeywords, Keyword } from "../mock-data";
import { AutoReplySubScreen } from "./AutoReplySubScreen";
import { V1EmptyState } from "@/components/v1/v1-polish";

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
  const [items, setItems] = useState(keywordsProp ?? seedKeywords);

  useEffect(() => {
    if (keywordsProp) setItems(keywordsProp);
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
            onClick={() =>
              onEdit({
                id: "new",
                keyword: "",
                lastSaved: "Never saved",
                description: "",
                connectedLists: 0,
                createsContacts: true,
                autoResponse: "Thanks for subscribing to Transovo text alerts.",
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus size={15} /> Create Keyword
          </button>
        }
      >
        <div className="mb-5 flex justify-end">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              className="field-input w-56 pl-9"
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
                onClick={() =>
                  onEdit({
                    id: "new",
                    keyword: "",
                    lastSaved: "Never saved",
                    description: "",
                    connectedLists: 0,
                    createsContacts: true,
                    autoResponse: "Thanks for subscribing to Transovo text alerts.",
                  })
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-[13px] font-semibold text-white hover:bg-indigo-700"
              >
                <Plus size={15} /> Create Keyword
              </button>
            }
          />
        ) : (
          <div className="overflow-visible rounded-[14px] border border-border bg-card shadow-sm">
            <table className="kw-table w-full">
              <thead>
                <tr>
                  <th>Keyword</th>
                  <th>Description</th>
                  <th></th>
                  <th>Creates Contacts</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((k) => (
                  <tr key={k.id}>
                    <td>
                      <div className="font-semibold text-foreground">{k.keyword || "(untitled)"}</div>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        Last saved on {k.lastSaved}
                      </div>
                    </td>
                    <td className="max-w-[280px] text-muted-foreground">{k.description}</td>
                    <td>
                      <span className="list-chip">
                        <ListChecks size={13} />
                        {k.connectedLists} Connected List{k.connectedLists === 1 ? "" : "s"}
                      </span>
                    </td>
                    <td>{k.createsContacts && <span className="badge-yes">Yes</span>}</td>
                    <td className="relative">
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuFor(menuFor === k.id ? null : k.id);
                        }}
                      >
                        <MoreVertical size={17} />
                      </button>
                      {menuFor === k.id && (
                        <div className="row-menu" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuFor(null);
                              onEdit(k);
                            }}
                          >
                            <Pencil size={15} /> Edit
                          </button>
                          <button type="button">
                            <QrCode size={15} /> Create QR Code
                          </button>
                          <button type="button">
                            <Link2 size={15} /> Create Tap-to-Join Link
                          </button>
                          <button type="button" className="danger">
                            <Trash2 size={15} /> Delete
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
          <select className="field-input w-32 text-[13px]">
            <option>25 Per Page</option>
            <option>50 Per Page</option>
          </select>
          <button type="button" onClick={onBack} className="ar-btn-secondary">
            Back
          </button>
        </div>
      </AutoReplySubScreen>
    </div>
  );
}
