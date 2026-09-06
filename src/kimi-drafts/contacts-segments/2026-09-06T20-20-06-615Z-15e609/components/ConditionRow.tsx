"use client";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, Trash2, Search, X, Check } from "lucide-react";
import { contactProperties, conditions, noValueConditions, usStates, appointmentStatuses, bookingTypes } from "../mock-data";

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
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`h-9 ${width} px-3 rounded-lg border bg-card text-sm flex items-center justify-between transition-all duration-150 ${
          open ? "border-primary ring-2 ring-ring/30" : "border-border hover:border-primary/40"
        } ${label ? "text-foreground" : "text-muted-foreground"}`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 ml-2 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 w-64 max-h-72 overflow-y-auto seg-scroll rounded-lg border border-border bg-card seg-dropdown seg-fade py-1">
          {children}
        </div>
      )}
    </div>
  );
}

export default function ConditionRow({
  cond,
  onChange,
  onRemove,
  listOptions = [],
}: {
  cond: ConditionState;
  onChange: (c: ConditionState) => void;
  onRemove: () => void;
  listOptions?: string[];
}) {
  const [openMenu, setOpenMenu] = useState<"property" | "condition" | "states" | null>(null);
  const [stateSearch, setStateSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const isState = cond.property === "State";
  const isListMembership = cond.property === "List Membership";
  const isApptStatus = cond.property === "Appointment Status";
  const isBookingType = cond.property === "Booking Type";
  const isMultiSelect = isState || isListMembership || isApptStatus || isBookingType;
  const noValue = noValueConditions.includes(cond.condition);

  const multiSource = isState ? usStates : isListMembership ? listOptions : isApptStatus ? appointmentStatuses : bookingTypes;
  const filteredMulti = multiSource.filter((s) => s.toLowerCase().includes(stateSearch.toLowerCase()));
  const searchLabel = isState ? "Search states" : isListMembership ? "Search lists" : isApptStatus ? "Search statuses" : "Search booking types";

  return (
    <div ref={ref} className="rounded-xl border border-border bg-muted/30 p-3 flex items-center gap-3 flex-wrap seg-fade">
      <Dropdown
        label={cond.property || "Select a Property"}
        open={openMenu === "property"}
        onToggle={() => setOpenMenu(openMenu === "property" ? null : "property")}
      >
        <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
          <Check className="h-3 w-3 text-primary" /> Select a Property
        </div>
        {contactProperties.map((g) => (
          <div key={g.group}>
            <div className="px-3 pt-2.5 pb-1 text-[10.5px] font-semibold text-muted-foreground uppercase tracking-widest">{g.group}</div>
            {g.items.map((p) => (
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
        <Dropdown
          label={cond.condition || "Select a Condition"}
          open={openMenu === "condition"}
          onToggle={() => setOpenMenu(openMenu === "condition" ? null : "condition")}
        >
          <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5 border-b border-border">
            <Check className="h-3 w-3 text-primary" /> Select a Condition
          </div>
          {conditions.map((c) => (
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
        isMultiSelect ? (
          <div className="relative flex-1 min-w-64">
            <div
              className={`min-h-9 rounded-lg border bg-card px-2 py-1 flex items-center gap-1.5 flex-wrap cursor-text transition-all duration-150 ${
                openMenu === "states" ? "border-primary ring-2 ring-ring/30" : "border-border hover:border-primary/40"
              }`}
              onClick={() => setOpenMenu("states")}
            >
              {cond.values.map((v) => (
                <span key={v} className="seg-chip">
                  {v}
                  <button
                    aria-label={`Remove ${v}`}
                    onClick={(e) => { e.stopPropagation(); onChange({ ...cond, values: cond.values.filter((x) => x !== v) }); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <span className="flex items-center gap-1 text-muted-foreground text-sm px-1">
                <Search className="h-3.5 w-3.5" />
                {cond.values.length === 0 ? "Search" : ""}
              </span>
            </div>
            {openMenu === "states" && (
              <div className="absolute left-0 top-11 z-30 w-64 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1">
                <div className="px-2 py-1.5 border-b border-border">
                  <input
                    autoFocus
                    value={stateSearch}
                    onChange={(e) => setStateSearch(e.target.value)}
                    placeholder={searchLabel}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full h-8 rounded-md border border-border bg-card px-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                <div className="max-h-52 overflow-y-auto seg-scroll py-1">
                  {filteredMulti.map((s) => {
                    const selected = cond.values.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange({ ...cond, values: selected ? cond.values.filter((x) => x !== s) : [...cond.values, s] });
                          setStateSearch("");
                        }}
                        className={`w-full px-3 py-1.5 text-sm text-left flex items-center justify-between transition-colors hover:bg-primary/5 hover:text-primary ${
                          selected ? "text-primary font-medium" : "text-foreground"
                        }`}
                      >
                        {s}
                        {selected && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })}
                  {filteredMulti.length === 0 && (
                    <p className="px-3 py-2 text-[13px] text-muted-foreground">No matches.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <input
            value={cond.value}
            onChange={(e) => onChange({ ...cond, value: e.target.value })}
            placeholder="Enter a value"
            className="seg-input flex-1 min-w-48 h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        )
      )}

      <button
        type="button"
        aria-label="Remove condition"
        onClick={onRemove}
        className="h-8 w-8 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground flex items-center justify-center transition-colors ml-auto"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
