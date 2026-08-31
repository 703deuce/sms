"use client";

import { useMemo, useState } from "react";
import { PieChart, Users, ChevronDown, Trash2, Check, Search, MapPin, Save, Eye, Send } from "lucide-react";
import { Segment, propertyGroups, conditions, usStates, saveOptions } from "../mock-data";

interface Rule {
  id: number;
  property: string;
  condition: string;
  value: string;
  values: string[]; // multi-select chips (e.g. states)
}
interface Group {
  id: number;
  rules: Rule[];
}
interface Props {
  segment?: Segment;
  onBack: () => void;
  onSaved: (s: Segment, dest: "contacts" | "segments" | "campaign") => void;
}

let uid = 1;
const blankRule = (): Rule => ({ id: uid++, property: "", condition: "", value: "", values: [] });

function PropertySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-44 items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-indigo-400"
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || "Select a Property"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="dropdown-panel absolute left-0 top-10 z-30 max-h-72 w-52 overflow-y-auto rounded-md border border-border bg-card py-1 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> Select a Property
          </div>
          {propertyGroups.map((g) => (
            <div key={g.label}>
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              {g.options.map((o) => (
                <button
                  key={o}
                  onClick={() => { onChange(o); setOpen(false); }}
                  className={`block w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white ${value === o ? "bg-indigo-50 font-medium text-indigo-700" : ""}`}
                >
                  {o}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConditionSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-56 items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm hover:border-indigo-400"
      >
        <span className={value ? "" : "text-muted-foreground"}>{value || "Select a Condition"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="dropdown-panel absolute left-0 top-10 z-30 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-card py-1 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground">
            <Check className="h-3.5 w-3.5" /> Select a Condition
          </div>
          {conditions.map((c) => (
            <button
              key={c}
              onClick={() => { onChange(c); setOpen(false); }}
              className={`block w-full px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white ${value === c ? "bg-indigo-50 font-medium text-indigo-700" : ""}`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StateMultiSelect({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = usStates.filter((s) => s.toLowerCase().includes(query.toLowerCase()) && !values.includes(s)).slice(0, 6);
  return (
    <div className="relative flex-1">
      <div
        className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 focus-within:border-indigo-500"
        onClick={() => setOpen(true)}
      >
        {values.map((v) => (
          <span key={v} className="chip">
            {v}
            <button onClick={(e) => { e.stopPropagation(); onChange(values.filter((x) => x !== v)); }}>×</button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          placeholder="Search"
          className="min-w-[80px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
      {open && results.length > 0 && (
        <div className="dropdown-panel absolute left-0 top-full z-30 mt-1 w-full rounded-md border border-border bg-card py-1 text-sm">
          {results.map((s) => (
            <button
              key={s}
              onClick={() => { onChange([...values, s]); setQuery(""); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-muted"
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateSegment({ segment, onBack, onSaved }: Props) {
  const [name, setName] = useState(segment?.name ?? "");
  const [groups, setGroups] = useState<Group[]>(
    segment
      ? [{ id: uid++, rules: [{ ...blankRule(), property: "Age", condition: "Is Greater Than or Equal To", value: "25" }] }]
      : [{ id: uid++, rules: [blankRule()] }]
  );
  const [saveMenu, setSaveMenu] = useState(false);

  const matched = useMemo(() => {
    const allRules = groups.flatMap((g) => g.rules).filter((r) => r.property && r.condition);
    if (allRules.length === 0) return 0;
    let n = 4753;
    if (allRules.some((r) => r.condition === "Is Not Known")) n = 5469;
    if (allRules.some((r) => r.property === "State" && r.values.length > 0)) n = 2793;
    return n;
  }, [groups]);

  const updateRule = (gid: number, rid: number, patch: Partial<Rule>) =>
    setGroups(groups.map((g) => (g.id === gid ? { ...g, rules: g.rules.map((r) => (r.id === rid ? { ...r, ...patch } : r)) } : g)));

  const removeRule = (gid: number, rid: number) =>
    setGroups(
      groups
        .map((g) => (g.id === gid ? { ...g, rules: g.rules.filter((r) => r.id !== rid) } : g))
        .filter((g) => g.rules.length > 0)
    );

  const addOrRule = (gid: number) =>
    setGroups(groups.map((g) => (g.id === gid ? { ...g, rules: [...g.rules, blankRule()] } : g)));

  const addAndGroup = () => setGroups([...groups, { id: uid++, rules: [blankRule()] }]);

  const save = (dest: "contacts" | "segments" | "campaign") => {
    const s: Segment = {
      id: segment?.id ?? `s${Date.now()}`,
      name: name || "Untitled Segment",
      created: segment?.created ?? "Created just now",
      description: null,
      contacts: matched,
    };
    onSaved(s, dest);
  };

  const needsValue = (r: Rule) => r.condition && !["Is Known", "Is Not Known"].includes(r.condition);
  const isState = (r: Rule) => r.property === "State" || r.property === "Province";

  return (
    <div className="mx-auto max-w-4xl px-8 py-8">
      {/* Breadcrumb */}
      <p className="text-xs text-muted-foreground">
        <button onClick={onBack} className="hover:text-indigo-600">Segments</button>
        <span className="mx-1">/</span> {segment ? "Edit Segment" : "Create Segment"}
      </p>

      <div className="mt-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card">
            <PieChart className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{segment ? "Edit Segment" : "Create Segment"}</h1>
            <p className="text-sm text-muted-foreground">Add conditions to create segments of your contacts.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{matched.toLocaleString()}</p>
          <p className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 text-indigo-500" /> Matched contacts
          </p>
        </div>
      </div>

      {/* Name */}
      <div className="mt-6">
        <label className="mb-1.5 block text-xs font-semibold">Segment Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. 25+ West Coast"
          className="w-full max-w-md rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* Rule groups */}
      <div className="mt-6 space-y-4">
        {groups.map((g, gi) => (
          <div key={g.id}>
            {gi > 0 && <p className="connector mb-2 text-center text-indigo-600">AND</p>}
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="space-y-3">
                {g.rules.map((r, ri) => (
                  <div key={r.id}>
                    {ri > 0 && <p className="connector mb-2 text-center text-amber-600">OR</p>}
                    <div className="flex items-center gap-2">
                      <PropertySelect value={r.property} onChange={(v) => updateRule(g.id, r.id, { property: v })} />
                      {r.property && (
                        <ConditionSelect value={r.condition} onChange={(v) => updateRule(g.id, r.id, { condition: v })} />
                      )}
                      {needsValue(r) &&
                        (isState(r) ? (
                          <StateMultiSelect values={r.values} onChange={(v) => updateRule(g.id, r.id, { values: v })} />
                        ) : (
                          <input
                            value={r.value}
                            onChange={(e) => updateRule(g.id, r.id, { value: e.target.value })}
                            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-indigo-500"
                          />
                        ))}
                      <button onClick={() => removeRule(g.id, r.id)} className="rounded-md p-2 text-muted-foreground hover:bg-red-50 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => addOrRule(g.id)} className="or-btn mt-3 rounded-md px-3 py-1.5 text-xs font-semibold">
                OR +
              </button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={addAndGroup} className="and-btn mt-4 rounded-md px-3 py-1.5 text-xs font-semibold">
        AND +
      </button>

      {/* Actions */}
      <div className="mt-8 flex items-center gap-3">
        <div className="relative">
          <div className="flex overflow-hidden rounded-md">
            <button onClick={() => save("segments")} className="btn-brand flex items-center gap-2 px-5 py-2 text-sm font-semibold">
              <Save className="h-4 w-4" /> Save
            </button>
            <button onClick={() => setSaveMenu(!saveMenu)} className="btn-brand border-l border-white/25 px-2.5">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {saveMenu && (
            <div className="dropdown-panel absolute bottom-11 left-0 z-30 w-56 rounded-md border border-border bg-card py-1 text-sm">
              <button onClick={() => save("contacts")} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted">
                <Users className="h-4 w-4 text-muted-foreground" /> Save &amp; View Contacts
              </button>
              <button onClick={() => save("segments")} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted">
                <Eye className="h-4 w-4 text-muted-foreground" /> Save &amp; View Segments
              </button>
              <button onClick={() => save("campaign")} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-muted">
                <Send className="h-4 w-4 text-muted-foreground" /> Save &amp; Create Campaign
              </button>
            </div>
          )}
        </div>
        <button onClick={onBack} className="rounded-md border border-border bg-card px-5 py-2 text-sm font-semibold hover:bg-muted">
          Back
        </button>
      </div>
    </div>
  );
}
