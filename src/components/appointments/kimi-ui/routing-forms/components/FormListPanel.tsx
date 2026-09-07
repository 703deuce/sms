import { Plus, Route } from "lucide-react";
import type { RoutingForm } from "../types";
import { routingAnalytics } from "../types";

type Props = {
  forms: RoutingForm[];
  selectedId: string | null;
  onSelect: (form: RoutingForm) => void;
  onNew: () => void;
};

export default function FormListPanel({ forms, selectedId, onSelect, onNew }: Props) {
  return (
    <div className="surface rounded-xl bg-card" style={{ padding: 12, alignSelf: "start" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 6px 10px" }}>
        <span className="section-label" style={{ margin: 0 }}>Forms</span>
        <button className="btn btn-ghost btn-icon" onClick={onNew} aria-label="New routing form" title="New routing form">
          <Plus size={16} />
        </button>
      </div>

      {forms.length === 0 ? (
        <div style={{ padding: "24px 12px", textAlign: "center" }}>
          <Route size={22} style={{ color: "hsl(var(--muted-foreground))", marginBottom: 8 }} />
          <p style={{ fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>No routing forms yet</p>
          <p className="text-muted-foreground" style={{ fontSize: 12, margin: "0 0 12px" }}>
            Create an intake form that routes leads to the right booking type.
          </p>
          <button className="btn btn-primary btn-sm" onClick={onNew}>
            <Plus size={14} /> New form
          </button>
        </div>
      ) : (
        forms.map((f) => {
          const a = routingAnalytics[f.id];
          return (
            <button
              key={f.id}
              type="button"
              className={`form-list-item ${selectedId === f.id ? "selected" : ""}`}
              onClick={() => onSelect(f)}
              aria-current={selectedId === f.id ? "true" : undefined}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
                {a ? (
                  <div className="text-muted-foreground" style={{ fontSize: 11.5, fontWeight: 400, marginTop: 1 }}>
                    {a.views} views
                  </div>
                ) : (
                  <div className="text-muted-foreground" style={{ fontSize: 11.5, fontWeight: 400, marginTop: 1 }}>
                    Draft
                  </div>
                )}
              </div>
              <span className={`chip ${f.active ? "chip-active" : "chip-inactive"}`}>
                {f.active ? "Active" : "Off"}
              </span>
            </button>
          );
        })
      )}
    </div>
  );
}
