"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Trash2, Search, X } from "lucide-react";
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
      <button onClick={onToggle} className={`h-9 ${width} px-3 rounded-md border border-border bg-card text-sm flex items-center justify-between hover:border-indigo-400 ${label ? "text-foreground" : "text-muted-foreground"}`}>
        <span className="truncate">{label}</span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 w-64 max-h-72 overflow-y-auto seg-scroll rounded-md border border-border bg-card seg-dropdown seg-fade py-1">
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
    <div ref={ref} className="rounded-lg border border-border bg-muted/40 p-3 flex items-center gap-3 flex-wrap seg-fade">
      <Dropdown label={cond.property || "Select a Property"} open={openMenu === "property"} onToggle={() => setOpenMenu(openMenu === "property" ? null : "property")}>
        <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
          <span className="text-indigo-600">✓</span> Select a Property
        </div>
        {contactProperties.map(g => (
          <div key={g.group}>
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{g.group}</div>
            {g.items.map(p => (
              <button key={p} onClick={() => { onChange({ ...cond, property: p, condition: "", value: "", values: [] }); setOpenMenu(null); }}
                className={`w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 hover:text-indigo-700 ${cond.property === p ? "bg-indigo-50 text-indigo-700" : "text-foreground"}`}>{p}</button>
            ))}
          </div>
        ))}
      </Dropdown>

      {cond.property && (
        <Dropdown label={cond.condition || "Select a Condition"} open={openMenu === "condition"} onToggle={() => setOpenMenu(openMenu === "condition" ? null : "condition")}>
          <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
            <span className="text-indigo-600">✓</span> Select a Condition
          </div>
          {conditions.map(c => (
            <button key={c} onClick={() => { onChange({ ...cond, condition: c }); setOpenMenu(null); }}
              className={`w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 hover:text-indigo-700 ${cond.condition === c ? "bg-indigo-50 text-indigo-700" : "text-foreground"}`}>{c}</button>
          ))}
        </Dropdown>
      )}

      {cond.property && cond.condition && !noValue && (
        isState ? (
          <div className="relative flex-1 min-w-64">
            <div className="min-h-9 rounded-md border border-border bg-card px-2 py-1 flex items-center gap-1.5 flex-wrap cursor-text" onClick={() => setOpenMenu("states")}>
              {cond.values.map(v => (
                <span key={v} className="seg-chip">{v}
                  <button onClick={(e) => { e.stopPropagation(); onChange({ ...cond, values: cond.values.filter(x => x !== v) }); }}><X className="h-3 w-3" /></button>
                </span>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground text-sm px-1"><Search className="h-3.5 w-3.5" />Search</span>
            </div>
            {openMenu === "states" && (
              <div className="absolute left-0 top-11 z-30 w-64 rounded-md border border-border bg-card seg-dropdown seg-fade py-1">
                <div className="px-2 py-1.5 border-b border-border">
                  <input autoFocus value={stateSearch} onChange={e => setStateSearch(e.target.value)} placeholder="Search states..."
                    className="w-full h-8 px-2 rounded border border-border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="max-h-48 overflow-y-auto seg-scroll">
                  {usStates.filter(s => s.toLowerCase().includes(stateSearch.toLowerCase()) && !cond.values.includes(s)).map(s => (
                    <button key={s} onClick={() => { onChange({ ...cond, values: [...cond.values, s] }); setStateSearch(""); }}
                      className="w-full px-3 py-1.5 text-sm text-left hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
                      <span className="h-4 w-4 rounded-sm border border-border inline-block" />{s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <input value={cond.value} onChange={e => onChange({ ...cond, value: e.target.value })} placeholder=""
            className="h-9 flex-1 min-w-40 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        )
      )}

      <button onClick={onRemove} className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground flex items-center justify-center ml-auto">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
