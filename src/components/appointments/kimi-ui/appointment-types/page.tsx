"use client";
import { useState } from "react";
import { Plus, ExternalLink } from "lucide-react";
import TypeListPanel from "./components/TypeListPanel";
import TypeEditorPanel from "./components/TypeEditorPanel";
import PreviewPanel from "./components/PreviewPanel";
import StatusPanel from "./components/StatusPanel";
import { appointmentTypes } from "./mock-data";
import "./reference.css";

export default function AppointmentTypesPage() {
  const [selectedId, setSelectedId] = useState("consult");
  const [showInactive, setShowInactive] = useState(true);
  const selected = appointmentTypes.find((t) => t.id === selectedId) ?? appointmentTypes[0];

  return (
    <div className="reference-root">
      <div className="max-w-[1560px] mx-auto px-8 py-6">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Appointment Types</h1>
            <p className="text-[13.5px] text-[#8a8fa3] mt-1">
              Manage the services you offer and how customers can book with you.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-lg border border-[#e4e6ee] bg-white hover:bg-[#f7f8fb]">
              View booking page <ExternalLink size={14} />
            </button>
            <button className="btn-brand flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg">
              <Plus size={15} /> New appointment type
            </button>
          </div>
        </div>

        {/* Three-column content */}
        <div className="flex gap-5 items-start">
          <div className="self-stretch flex">
            <TypeListPanel
              types={appointmentTypes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              showInactive={showInactive}
              onToggleInactive={() => setShowInactive((v) => !v)}
            />
          </div>
          <TypeEditorPanel key={selected.id} type={selected} />
          <div className="w-[300px] shrink-0 space-y-5">
            <PreviewPanel key={`p-${selected.id}`} type={selected} />
            <StatusPanel key={`s-${selected.id}`} type={selected} />
          </div>
        </div>
      </div>
    </div>
  );
}
