import { useState } from "react";
import { Search, Plus, MoreVertical, Pencil, QrCode, Link2, Trash2, ListChecks, Tags } from "lucide-react";
import { keywords, Keyword } from "../mock-data";

export default function KeywordsList({
  onEdit,
  onBack,
}: {
  onEdit: (k: Keyword) => void;
  onBack: () => void;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = keywords.filter((k) =>
    k.keyword.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div onClick={() => menuFor && setMenuFor(null)}>
      <p className="text-[12.5px] text-muted-foreground mb-1">Auto-Replies / Keywords</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Tags size={22} className="text-indigo-600" />
          <h1 className="text-[24px] font-bold text-foreground tracking-tight">Keywords</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field-input pl-9 w-56"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
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
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[13.5px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus size={15} /> Create Keyword
          </button>
        </div>
      </div>
      <p className="text-[14px] text-muted-foreground mt-1.5">
        View and manage all of your keywords. Each keyword can override the default opt-in
        auto-response.
      </p>

      <div className="bg-card border border-border rounded-2xl mt-6 overflow-visible">
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
                  <div className="text-[12px] text-muted-foreground mt-0.5">
                    Last saved on {k.lastSaved}
                  </div>
                </td>
                <td className="text-muted-foreground max-w-[280px]">{k.description}</td>
                <td>
                  <span className="list-chip">
                    <ListChecks size={13} />
                    {k.connectedLists} Connected List{k.connectedLists === 1 ? "" : "s"}
                  </span>
                </td>
                <td>{k.createsContacts && <span className="badge-yes">Yes</span>}</td>
                <td className="relative">
                  <button
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
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
                        onClick={() => {
                          setMenuFor(null);
                          onEdit(k);
                        }}
                      >
                        <Pencil size={15} /> Edit
                      </button>
                      <button>
                        <QrCode size={15} /> Create QR Code
                      </button>
                      <button>
                        <Link2 size={15} /> Create Tap-to-Join Link
                      </button>
                      <button className="danger">
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

      <div className="flex items-center justify-between mt-5">
        <select className="field-input w-32 text-[13px]">
          <option>25 Per Page</option>
          <option>50 Per Page</option>
        </select>
        <button
          onClick={onBack}
          className="border border-border bg-card text-[14px] font-medium px-6 py-2.5 rounded-lg hover:bg-muted transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}
