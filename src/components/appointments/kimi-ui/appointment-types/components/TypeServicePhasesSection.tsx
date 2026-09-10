"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

type PhaseRow = {
  id?: string;
  name: string;
  phaseKind: "active_staff" | "processing";
  durationMinutes: number;
  staffRequired: boolean;
  displayOrder: number;
};

const PHASE_KINDS: Array<{ value: PhaseRow["phaseKind"]; label: string }> = [
  { value: "active_staff", label: "Active (staff required)" },
  { value: "processing", label: "Processing (room / passive)" },
];

type Props = {
  appointmentTypeId: string | null;
  isCreating: boolean;
};

export function TypeServicePhasesSection({ appointmentTypeId, isCreating }: Props) {
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!appointmentTypeId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/appointments/service-booking/service-phases?appointmentTypeId=${encodeURIComponent(appointmentTypeId)}`,
      );
      if (!res.ok) throw new Error("load failed");
      const json = await res.json();
      const rows = (json.data || json || []) as Array<{
        id: string;
        name: string;
        phaseKind: PhaseRow["phaseKind"];
        durationMinutes: number;
        staffRequired: boolean;
        displayOrder: number;
      }>;
      setPhases(
        rows.map((r) => ({
          id: r.id,
          name: r.name,
          phaseKind: r.phaseKind,
          durationMinutes: r.durationMinutes,
          staffRequired: r.staffRequired,
          displayOrder: r.displayOrder,
        })),
      );
    } catch {
      setPhases([]);
    } finally {
      setLoading(false);
    }
  }, [appointmentTypeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePhases() {
    if (!appointmentTypeId) return;
    setSaving(true);
    setMessage("");
    try {
      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i];
        if (!phase.name.trim() || phase.durationMinutes <= 0) continue;
        await fetch("/api/appointments/service-booking/service-phases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: phase.id,
            appointmentTypeId,
            name: phase.name.trim(),
            phaseKind: phase.phaseKind,
            durationMinutes: phase.durationMinutes,
            staffRequired: phase.staffRequired,
            displayOrder: i,
          }),
        });
      }
      setMessage("Phases saved");
      await load();
    } catch {
      setMessage("Could not save phases");
    } finally {
      setSaving(false);
    }
  }

  function addPhase() {
    setPhases((prev) => [
      ...prev,
      {
        name: "",
        phaseKind: "active_staff",
        durationMinutes: 15,
        staffRequired: true,
        displayOrder: prev.length,
      },
    ]);
  }

  function updatePhase(index: number, patch: Partial<PhaseRow>) {
    setPhases((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function removePhase(index: number) {
    const phase = phases[index];
    if (phase?.id) {
      setSaving(true);
      setMessage("");
      try {
        const res = await fetch(
          `/api/appointments/service-booking/service-phases/${encodeURIComponent(phase.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("delete failed");
        setMessage("Phase removed");
      } catch {
        setMessage("Could not remove phase");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  const totalMinutes = phases.reduce((sum, p) => sum + (p.durationMinutes || 0), 0);

  if (isCreating) {
    return (
      <section aria-labelledby="type-phases-heading">
        <h3 id="type-phases-heading" className="text-[14px] font-semibold mb-1">Service phases</h3>
        <p className="text-[12.5px] text-[#8a8fa3]">
          Save this appointment type first, then configure phased durations (e.g. consult + treatment).
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="type-phases-heading">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 id="type-phases-heading" className="text-[14px] font-semibold">Service phases</h3>
          <p className="text-[12.5px] text-[#8a8fa3] mt-1">
            Chain sub-steps for availability and duration. Total blocked time: {totalMinutes} min
            {totalMinutes > 0 ? " (overrides base duration when phases exist)" : ""}.
          </p>
        </div>
        <button
          type="button"
          className="text-[12px] font-medium text-[#147d74] flex items-center gap-1"
          onClick={addPhase}
        >
          <Plus size={14} /> Add phase
        </button>
      </div>
      {loading ? (
        <p className="text-[12px] text-[#8a8fa3]">Loading phases…</p>
      ) : phases.length === 0 ? (
        <p className="text-[12.5px] text-[#8a8fa3] rounded-xl border border-dashed border-[#e4e6ee] px-4 py-6 text-center">
          No phases — booking uses the base duration above.
        </p>
      ) : (
        <div className="space-y-3">
          {phases.map((phase, index) => (
            <div key={phase.id || `new-${index}`} className="rounded-xl border border-[#ecedf2] p-3 grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4">
                <label className="label text-[11px]">Name</label>
                <input
                  className="input w-full text-[12px]"
                  value={phase.name}
                  onChange={(e) => updatePhase(index, { name: e.target.value })}
                  placeholder="e.g. Consultation"
                />
              </div>
              <div className="col-span-3">
                <label className="label text-[11px]">Kind</label>
                <select
                  className="input w-full text-[12px]"
                  value={phase.phaseKind}
                  onChange={(e) =>
                    updatePhase(index, {
                      phaseKind: e.target.value as PhaseRow["phaseKind"],
                      staffRequired: e.target.value === "active_staff",
                    })
                  }
                >
                  {PHASE_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>{k.label}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label text-[11px]">Minutes</label>
                <input
                  className="input w-full text-[12px]"
                  type="number"
                  min={1}
                  value={phase.durationMinutes}
                  onChange={(e) => updatePhase(index, { durationMinutes: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="col-span-2 flex items-center pb-2">
                <label className="flex items-center gap-1.5 text-[11px]">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={phase.staffRequired}
                    onChange={(e) => updatePhase(index, { staffRequired: e.target.checked })}
                  />
                  Staff
                </label>
              </div>
              <div className="col-span-1 flex justify-end pb-1">
                <button
                  type="button"
                  className="text-[#a0a3b5] hover:text-rose-600 disabled:opacity-40"
                  disabled={saving}
                  onClick={() => void removePhase(index)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          className="text-[12px] font-semibold text-white bg-[#147d74] px-4 py-2 rounded-lg disabled:opacity-50"
          onClick={() => void savePhases()}
          disabled={saving || !appointmentTypeId}
        >
          {saving ? "Saving…" : "Save phases"}
        </button>
        {message ? <span className="text-[12px] text-[#6b6f82]">{message}</span> : null}
      </div>
    </section>
  );
}
