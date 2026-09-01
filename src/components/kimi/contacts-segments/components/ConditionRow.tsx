"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Trash2, Search, X, Check } from "lucide-react";
import { contactProperties, conditions, noValueConditions, usStates } from "../mock-data";

export interface ConditionState {
  id: string;
  property: string;
  condition: string;
  value: string;
  values: string[];
}

function Dropdown({ label, open, onToggle, children, width = "w-60" }: any) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={`h-9 ${width} px-3 rounded-lg border bg-card text-sm flex items-center justify-between transition-all duration-150 ${
          open
            ? "border-primary ring-2 ring-ring/30"
            : "border-border hover:border-primary/40"
        } ${label ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 w-64 max-h-72 overflow-y-auto seg-scroll rounded-lg border border-border bg-card seg-dropdown seg-fade py-1 shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ConditionRow({ cond, onChange, onRemove }: {
  cond: ConditionState;
  onChange: (c: ConditionState) => void;
  onRemove: () => void;
}) {
  const [openMenu, setOpenMenu] = useState<"property" | "condition" | "states" | null>(null);
  const [stateSearch, setStateSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isState = cond.property === "State";
  const noValue = noValueConditions.includes(cond.condition);

  return (
    <div ref={ref} className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3 flex-wrap seg-fade">
      <Dropdown label={cond.property || "Select a Property"} open={openMenu === "property"} onToggle={() => setOpenMenu(openMenu === "property" ? null : "property")}>
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
          <Check className="h-3 w-3 text-primary" /> Select a Property
        </div>
        {contactProperties.map(g => (
          <div key={g.group}>
            <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">{g.group}</div>
            {g.items.map(p => (
              <button
                key={p}
                onClick={() => { onChange({ ...cond, property: p, condition: "", value: "", values: [] }); setOpenMenu(null); }}
                className={`w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-primary/5 hover:text-primary ${
                  cond.property === p ? "bg-primary/5 text-primary font-medium" : "text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        ))}
      </Dropdown>

      {cond.property && (
        <Dropdown label={cond.condition || "Select a Condition"} open={openMenu === "condition"} onToggle={() => setOpenMenu(openMenu === "condition" ? null : "condition")}>
          <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
            <Check className="h-3 w-3 text-primary" /> Select a Condition
          </div>
          {conditions.map(c => (
            <button
              key={c}
              onClick={() => { onChange({ ...cond, condition: c }); setOpenMenu(null); }}
              className={`w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-primary/5 hover:text-primary ${
                cond.condition === c ? "bg-primary/5 text-primary font-medium" : "text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </Dropdown>
      )}

      {cond.property && cond.condition && !noValue && (
        isState ? (
          <div className="relative flex-1 min-w-64">
            <div
              className={`min-h-9 rounded-lg border bg-card px-2 py-1 flex items-center gap-1.5 flex-wrap cursor-text transition-all duration-150 ${
                openMenu === "states" ? "border-primary ring-2 ring-ring/30" : "border-border hover:border-primary/40"
              }`}
              onClick={() => setOpenMenu("states")}
            >
              {cond.values.map(v => (
                <span key={v} className="seg-chip">
                  {v}
                  <button onClick={(e) => { e.stopPropagation(); onChange({ ...cond, values: cond.values.filter(x => x !== v) }); }}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground text-sm px-1">
                <Search className="h-3.5 w-3.5" />Search
              </span>
            </div>
            {openMenu === "states" && (
              <div className="absolute left-0 top-11 z-30 w-64 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1 shadow-lg">
                <div className="px-2 py-1.5 border-b border-border">
                  <input
                    autoFocus
                    value={stateSearch}
                    onChange={e => setStateSearch(e.target.value)}
                    placeholder="Search states..."
                    className="seg-input w-full h-8 px-2 rounded-md border border-border text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 transition"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto seg-scroll">
                  {usStates.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()) && !cond.values.includes(s)).map(s => (
                    <button
                      key={s}
                      onClick={() => { onChange({ ...cond, values: [...cond.values, s] }); setStateSearch(""); }}
                      className="w-full px-3 py-1.5 text-sm text-left transition-colors hover:bg-primary/5 hover:text-primary flex items-center gap-2"
                    >
                      <span className="h-4 w-4 rounded border border-border inline-block" />{s}
                    </button>
                  ))}
                  {usStates.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()) && !cond.values.includes(s)).length === 0 && (
                    <div className="px-3 py-3 text-xs text-muted-foreground">No matching states.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <input
            value={cond.value}
            onChange={e => onChange({ ...cond, value: e.target.value })}
            placeholder="Enter a value"
            className="seg-input h-9 flex-1 min-w-40 rounded-lg border border-border bg-card px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        )
      )}

      <button
        onClick={onRemove}
        className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground flex items-center justify-center ml-auto transition-colors"
        title="Remove condition"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
