"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import { Users, ChevronDown, Save, Eye, PieChart as PieIcon, Send, Loader2 } from "lucide-react";
import ConditionRow, { ConditionState } from "./ConditionRow";
import { computeMatched, Segment } from "../mock-data";
import { PieSlice } from "./SegmentsList";
import type { KimiConditionGroup } from "@/lib/contacts/kimi-segment-condition-map";
import { segmentConditionsToKimiGroups } from "@/lib/contacts/kimi-segment-condition-map";

interface Group { id: string; conditions: ConditionState[]; }

let uid = 0;
const nid = () => `g${++uid}_${Date.now()}`;
const newCond = (): ConditionState => ({ id: nid(), property: "", condition: "", value: "", values: [] });

function seedGroups(editing?: Segment | null): Group[] {
  if (editing?.conditions) {
    const kimiGroups = segmentConditionsToKimiGroups(editing.conditions);
    return kimiGroups.map((g) => ({
      id: nid(),
      conditions: g.conditions.map((c) => ({
        ...c,
        id: nid(),
        values: c.values ?? [],
      })),
    }));
  }
  if (editing) {
    return [{ id: nid(), conditions: [newCond()] }];
  }
  return [{ id: nid(), conditions: [newCond()] }];
}

export default function CreateSegment({ editing, onBack, onSaved, onViewContacts, onCreateCampaign, onSaveSegment, onSaveError, onPreviewCount }: {
  editing?: Segment | null;
  onBack: () => void;
  onSaved: (seg: Segment, mode: "segments" | "contacts" | "campaign") => void;
  onViewContacts: (seg: Segment) => void;
  onCreateCampaign: (seg: Segment) => void;
  onSaveSegment?: (input: {
    name: string;
    editing: Segment | null | undefined;
    contactCount: number;
    groups: KimiConditionGroup[];
  }) => Promise<Segment>;
  onSaveError?: (message: string) => void;
  onPreviewCount?: (groups: KimiConditionGroup[]) => Promise<number>;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [groups, setGroups] = useState<Group[]>(() => seedGroups(editing));
  const [calculating, setCalculating] = useState(false);
  const [displayCount, setDisplayCount] = useState<number | null>(null);
  const [saveMenu, setSaveMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const matched = useMemo(() => computeMatched(name, groups), [groups, name]);

  useEffect(() => {
    if (!onPreviewCount) {
      setCalculating(true);
      const t = setTimeout(() => { setDisplayCount(matched); setCalculating(false); }, 450);
      return () => clearTimeout(t);
    }
    let cancelled = false;
    setCalculating(true);
    const t = setTimeout(() => {
      void onPreviewCount(groups)
        .then((count) => {
          if (!cancelled) {
            setDisplayCount(count);
            setCalculating(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDisplayCount(null);
            setCalculating(false);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [groups, matched, onPreviewCount]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setSaveMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const updateCond = (gid: string, c: ConditionState) =>
    setGroups(gs => gs.map(g => g.id === gid ? { ...g, conditions: g.conditions.map(x => x.id === c.id ? c : x) } : g));
  const removeCond = (gid: string, cid: string) =>
    setGroups(gs => gs.map(g => g.id === gid ? { ...g, conditions: g.conditions.filter(x => x.id !== cid) } : g).filter(g => g.conditions.length > 0));
  const addOr = (gid: string) =>
    setGroups(gs => gs.map(g => g.id === gid ? { ...g, conditions: [...g.conditions, newCond()] } : g));
  const addAnd = () => setGroups(gs => [...gs, { id: nid(), conditions: [newCond()] }]);

  const doSave = (mode: "segments" | "contacts" | "campaign") => {
    const fallback: Segment = {
      id: editing?.id ?? `s_${Date.now()}`,
      name: name || "Untitled Segment",
      createdAt: editing?.createdAt ?? "Today @ " + new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      contacts: displayCount ?? matched,
    };
    const finish = (seg: Segment) => {
      const existing: Segment[] = (window as any).__transovoSegments ?? [];
      const next = editing ? existing.map(s => s.id === seg.id ? seg : s) : [...existing, seg];
      (window as any).__transovoSegments = next;
      setSaveMenu(false);
      onSaved(seg, mode);
    };
    if (onSaveSegment) {
      void onSaveSegment({
        name: name || "Untitled Segment",
        editing,
        contactCount: displayCount ?? matched,
        groups,
      })
        .then(finish)
        .catch((err) => {
          setSaveMenu(false);
          onSaveError?.(err instanceof Error ? err.message : "Could not save segment");
        });
      return;
    }
    finish(fallback);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto seg-fade">
      <p className="text-xs text-muted-foreground mb-1">Segments / {editing ? "Edit Segment" : "Create Segment"}</p>
      <div className="flex items-center gap-3 mb-1">
        <div className="h-9 w-9 rounded-full border-2 border-indigo-600 flex items-center justify-center"><PieSlice /></div>
        <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{editing ? "Edit Segment" : "Create Segment"}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12">Add conditions to create segments of your contacts.</p>

      <div className="flex items-start justify-between gap-6 mb-5">
        <div className="flex-1 max-w-xl">
          <label className="text-sm font-medium text-foreground">Segment Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="25+ West Coast"
            className="seg-input mt-1.5 w-full h-10 rounded-lg border border-border bg-card px-3 text-sm" />
        </div>
        <div className="flex flex-col items-center pt-1 min-w-28">
          <span className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100 flex items-center justify-center"><Users className="h-4 w-4" /></span>
          <span className="text-lg font-bold text-foreground mt-1 h-6 tabular-nums">
            {calculating ? <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mt-1" /> : (displayCount ?? 0).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">Matched contacts</span>
        </div>
      </div>

      <div className="space-y-0">
        {groups.map((g, gi) => (
          <div key={g.id}>
            {gi > 0 && (
              <div className="flex items-center gap-3 my-3 ml-6">
                <span className="text-[11px] font-bold tracking-wide text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-2 py-0.5">AND</span>
                <div className="h-px flex-1 bg-indigo-100" />
              </div>
            )}
            <div className="space-y-3">
              {g.conditions.map((c, ci) => (
                <div key={c.id}>
                  {ci > 0 && (
                    <div className="flex items-center gap-3 my-2 ml-6">
                      <span className="text-[11px] font-bold tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">OR</span>
                      <div className="h-px flex-1 bg-amber-100" />
                    </div>
                  )}
                  <ConditionRow cond={c} onChange={(nc) => updateCond(g.id, nc)} onRemove={() => removeCond(g.id, c.id)} />
                </div>
              ))}
            </div>
            <button onClick={() => addOr(g.id)}
              className="mt-3 ml-1 h-8 px-3 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200 transition-colors">
              OR &nbsp;+
            </button>
          </div>
        ))}
      </div>

      <button onClick={addAnd}
        className="mt-4 h-8 px-3 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-800 text-xs font-semibold border border-indigo-200 transition-colors">
        AND &nbsp;+
      </button>

      <div className="mt-8 flex items-center gap-3">
        <div className="relative flex" ref={menuRef}>
          <button onClick={() => doSave("segments")} disabled={!name}
            className="seg-btn-primary h-10 px-5 rounded-l-lg text-sm font-medium flex items-center gap-2">
            <Save className="h-4 w-4" /> Save
          </button>
          <button onClick={() => setSaveMenu(!saveMenu)} disabled={!name}
            className="seg-btn-primary h-10 px-2.5 rounded-r-lg border-l border-indigo-400/60">
            <ChevronDown className={`h-4 w-4 transition-transform ${saveMenu ? "rotate-180" : ""}`} />
          </button>
          {saveMenu && (
            <div className="absolute left-0 bottom-12 z-30 w-56 rounded-lg border border-border bg-card seg-dropdown seg-fade py-1">
              <button onClick={() => doSave("contacts")} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"><Eye className="h-4 w-4 text-muted-foreground" /> Save &amp; View Contacts</button>
              <button onClick={() => doSave("segments")} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"><PieIcon className="h-4 w-4 text-muted-foreground" /> Save &amp; View Segments</button>
              <button onClick={() => doSave("campaign")} className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2 transition-colors"><Send className="h-4 w-4 text-muted-foreground" /> Save &amp; Create Campaign</button>
            </div>
          )}
        </div>
        <button onClick={onBack} className="h-10 px-5 rounded-lg border border-border bg-card hover:bg-muted text-sm font-medium text-foreground transition-colors">Back</button>
      </div>
    </div>
  );
}
