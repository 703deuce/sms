"use client";
import { useState, useRef, useEffect } from "react";
import { Users, ChevronDown, Plus, Loader2, AlertCircle } from "lucide-react";
import ConditionRow, { ConditionState } from "./ConditionRow";
import { Segment } from "../mock-data";
import { PieSlice } from "./SegmentsList";

interface Group { id: string; conditions: ConditionState[] }

let uid = 0;
const nid = () => `g${++uid}_${Date.now()}`;
const newCond = (): ConditionState => ({ id: nid(), property: "", condition: "", value: "", values: [] });

function seedGroups(editing?: Segment | null): Group[] {
  if (editing?.conditions?.groups?.length) {
    return editing.conditions.groups.map((g: any) => ({
      id: nid(),
      conditions: (g.conditions ?? []).map((c: any) => ({
        id: nid(),
        property: c.property ?? "",
        condition: c.condition ?? "",
        value: c.value ?? "",
        values: c.values ?? [],
      })),
    }));
  }
  return [{ id: nid(), conditions: [newCond()] }];
}

export default function CreateSegment({
  editing,
  listOptions = [],
  onBack,
  onSaved,
}: {
  editing?: Segment | null;
  listOptions?: string[];
  onBack: () => void;
  onSaved: (seg: Segment, mode: "segments" | "contacts") => void;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [groups, setGroups] = useState<Group[]>(() => seedGroups(editing));
  const [calculating, setCalculating] = useState(false);
  const [displayCount, setDisplayCount] = useState<number | null>(editing?.contacts ?? null);
  const [saveMenu, setSaveMenu] = useState(false);
  const [saveError, setSaveError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Simulated live preview count (debounced) — backend contract: /api/contacts/segments/preview
  useEffect(() => {
    setCalculating(true);
    const t = setTimeout(() => {
      const filled = groups.reduce(
        (n, g) => n + g.conditions.filter((c) => c.property && c.condition).length,
        0
      );
      setDisplayCount(filled === 0 ? 0 : Math.max(3, 1847 - filled * 311));
      setCalculating(false);
    }, 350);
    return () => clearTimeout(t);
  }, [groups]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setSaveMenu(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const updateCond = (gid: string, c: ConditionState) =>
    setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, conditions: g.conditions.map((x) => (x.id === c.id ? c : x)) } : g)));
  const removeCond = (gid: string, cid: string) =>
    setGroups((gs) =>
      gs
        .map((g) => (g.id === gid ? { ...g, conditions: g.conditions.filter((x) => x.id !== cid) } : g))
        .filter((g) => g.conditions.length > 0)
    );
  const addOr = (gid: string) =>
    setGroups((gs) => gs.map((g) => (g.id === gid ? { ...g, conditions: [...g.conditions, newCond()] } : g)));
  const addAnd = () => setGroups((gs) => [...gs, { id: nid(), conditions: [newCond()] }]);

  const doSave = (mode: "segments" | "contacts") => {
    setSaveError("");
    const seg: Segment = {
      id: editing?.id ?? `s_${Date.now()}`,
      name: name.trim() || "Untitled Segment",
      createdAt: editing?.createdAt ?? "Today @ " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      contacts: displayCount ?? 0,
      conditions: { groups },
    };
    setSaveMenu(false);
    onSaved(seg, mode);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1.5">
        <button onClick={onBack} className="hover:text-primary transition-colors">Segments</button>
        <span className="text-border">/</span>
        <span className="text-foreground font-medium">{editing ? "Edit Segment" : "Create Segment"}</span>
      </nav>
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-full border-2 border-primary flex items-center justify-center"><PieSlice /></div>
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-foreground">{editing ? "Edit Segment" : "Create Segment"}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">Add conditions to create dynamic groups of your contacts.</p>

      {saveError && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-[13px] text-red-800">{saveError} Your conditions are preserved — try saving again.</p>
        </div>
      )}

      <div className="seg-card rounded-xl border border-border bg-card p-5 mb-5">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="flex-1 max-w-xl min-w-64">
            <label htmlFor="seg-name" className="block text-[13px] font-medium text-foreground">Segment Name</label>
            <input
              id="seg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 25+ West Coast"
              className="seg-input mt-1.5 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Matched contacts</p>
            <p className="mt-1 flex items-center justify-end gap-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {calculating ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                (displayCount ?? 0).toLocaleString()
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
              <Users className="h-3 w-3" /> updates as you build
            </p>
          </div>
        </div>
      </div>

      {groups.map((g, gi) => (
        <div key={g.id}>
          {gi > 0 && (
            <div className="seg-logic-and"><span>And</span></div>
          )}
          <div className="seg-card rounded-xl border border-border bg-card p-4">
            {g.conditions.map((c, ci) => (
              <div key={c.id}>
                {ci > 0 && <div className="seg-logic-or"><span>Or</span></div>}
                <ConditionRow
                  cond={c}
                  listOptions={listOptions}
                  onChange={(nc) => updateCond(g.id, nc)}
                  onRemove={() => removeCond(g.id, c.id)}
                />
              </div>
            ))}
            <button
              onClick={() => addOr(g.id)}
              className="mt-3 h-8 px-3 rounded-lg border border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground text-[13px] font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add OR condition
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={addAnd}
        className="mt-4 h-9 px-3.5 rounded-lg border border-dashed border-border hover:border-primary/50 hover:text-primary text-muted-foreground text-[13px] font-medium flex items-center gap-1.5 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Add AND group
      </button>

      <div className="flex items-center justify-end gap-2.5 mt-7 pt-5 border-t border-border">
        <button
          onClick={onBack}
          className="h-9 px-4 rounded-lg border border-border bg-card hover:bg-muted/70 text-sm font-medium text-foreground transition-colors"
        >
          Cancel
        </button>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setSaveMenu(!saveMenu)}
            aria-expanded={saveMenu}
            className="seg-btn-primary h-9 pl-4 pr-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all duration-150 active:scale-[0.98]"
          >
            {editing ? "Save Changes" : "Save Segment"}
            <ChevronDown className={`h-4 w-4 transition-transform duration-150 ${saveMenu ? "rotate-180" : ""}`} />
          </button>
          {saveMenu && (
            <div className="absolute right-0 bottom-11 z-30 w-56 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1">
              <button onClick={() => doSave("segments")} className="w-full px-3 py-2 text-sm text-left hover:bg-primary/5 hover:text-primary transition-colors">
                Save &amp; return to Segments
              </button>
              <button onClick={() => doSave("contacts")} className="w-full px-3 py-2 text-sm text-left hover:bg-primary/5 hover:text-primary transition-colors">
                Save &amp; view Contacts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
