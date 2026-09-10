"use client";

import { Plus, Users } from "lucide-react";
import StaffListPanel from "./components/StaffListPanel";
import StaffEditorPanel from "./components/StaffEditorPanel";
import type { StaffPageActions, StaffPageModel } from "@/features/appointments/kimi/staff/types";
import "../appointment-types/reference.css";
import "./reference.css";

type Props = {
  model: StaffPageModel;
  actions: StaffPageActions;
};

export default function StaffView({ model, actions }: Props) {
  const selected = model.selected;

  return (
    <div className="reference-root staff-page">
      <div className="max-w-[1280px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-3.5 min-w-0">
            <span className="w-10 h-10 rounded-full bg-[#efecfd] text-[#5b45e0] flex items-center justify-center mt-0.5 ring-4 ring-[#efecfd]/40">
              <Users size={19} strokeWidth={2.1} />
            </span>
            <div>
              <h1 className="text-[24px] leading-[30px] font-bold tracking-tight text-[#1a1d29]">
                Team / Staff
              </h1>
              <p className="text-[13.5px] leading-[20px] text-[#8a8fa3] mt-1">
                Manage bookable staff, their services, locations, and availability overrides.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="btn-brand flex items-center gap-1.5 text-[13px] font-semibold h-9 px-4 rounded-lg shadow-sm"
            onClick={actions.onAddStaff}
          >
            <Plus size={15} strokeWidth={2.5} /> Add staff
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start">
          <StaffListPanel
            staff={model.visibleStaff}
            totalCount={model.staff.length}
            selectedId={model.selectedId}
            searchQuery={model.searchQuery}
            onSelect={actions.onSelectStaff}
            onSearchChange={actions.onSearchChange}
          />
          {selected ? (
            <StaffEditorPanel
              tab={model.editorTab}
              name={selected.name}
              active={selected.active !== false}
              customerSelectable={selected.customerSelectable !== false}
              appointmentTypes={model.appointmentTypes}
              locations={model.locations}
              selectedTypeIds={selected.appointmentTypeIds || []}
              selectedLocationIds={selected.locationIds || []}
              dayRows={model.dayRows}
              calendarColor={selected.calendarColor || "#5b4bff"}
              roundRobinStats={model.roundRobinStats}
              saving={model.saving}
              saved={model.saved}
              error={model.error}
              onTabChange={actions.onTabChange}
              onNameChange={actions.onNameChange}
              onActiveChange={actions.onActiveChange}
              onCustomerSelectableChange={actions.onCustomerSelectableChange}
              onToggleTypeId={actions.onToggleTypeId}
              onToggleLocationId={actions.onToggleLocationId}
              onSetCustomHours={actions.onSetCustomHours}
              onUpdateWindow={actions.onUpdateWindow}
              onAddWindow={actions.onAddWindow}
              onCalendarColorChange={actions.onCalendarColorChange}
              onSave={actions.onSave}
              onRemove={() => actions.onRemoveStaff(selected.id)}
            />
          ) : (
            <div className="card min-h-[560px] flex items-center justify-center p-10 text-center">
              <div>
                <Users className="h-10 w-10 mx-auto text-[#c6c9d6] mb-3" />
                <p className="text-[14px] font-semibold text-[#1a1d29]">Select a team member</p>
                <p className="text-[13px] text-[#8a8fa3] mt-1">
                  Choose someone from the list or add a new staff member to get started.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
