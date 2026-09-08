"use client";

import { Plus, ExternalLink } from "lucide-react";
import TypeListPanel from "./components/TypeListPanel";
import TypeEditorPanel from "./components/TypeEditorPanel";
import { TypeBulkEditPanel } from "@/components/appointments/type-bulk-edit-panel";
import PreviewPanel from "./components/PreviewPanel";
import StatusPanel from "./components/StatusPanel";
import type {
  AppointmentTypesPageActions,
  AppointmentTypesPageModel,
} from "@/features/appointments/kimi/appointment-types/types";
import "./reference.css";

type Props = {
  model: AppointmentTypesPageModel;
  actions: AppointmentTypesPageActions;
};

export default function AppointmentTypesView({ model, actions }: Props) {
  const selected = model.selected;

  return (
    <div className="reference-root">
      <div className="max-w-[1560px] mx-auto px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[30px] font-bold tracking-tight text-[#1a1d29]">
              Appointment Types
            </h1>
            <p className="text-[13.5px] leading-[20px] text-[#8a8fa3] mt-1">
              Manage the services you offer and how customers can book with you.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 pt-0.5">
            <button
              type="button"
              className="flex items-center gap-1.5 text-[13px] font-medium h-9 px-3.5 rounded-lg border border-[#e4e6ee] bg-white text-[#3c4257] shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors hover:bg-[#f7f8fb] hover:border-[#d8dbe6] disabled:opacity-50 disabled:pointer-events-none"
              onClick={actions.onViewBookingPage}
              disabled={!model.bookingBaseUrl}
            >
              View booking page <ExternalLink size={13} className="text-[#8a8fa3]" />
            </button>
            <button
              type="button"
              className="btn-brand flex items-center gap-1.5 text-[13px] font-semibold h-9 px-4 rounded-lg shadow-sm transition-all duration-150 active:scale-[0.98]"
              onClick={actions.onNewType}
            >
              <Plus size={15} strokeWidth={2.5} /> New appointment type
            </button>
          </div>
        </div>

        <div className="flex gap-5 items-start">
          <div className="self-stretch flex w-[300px] shrink-0">
            <TypeListPanel
              types={model.visibleTypes}
              totalCount={model.types.length}
              selectedId={model.selectedId}
              searchQuery={model.searchQuery}
              onSelect={actions.onSelectType}
              showInactive={model.showInactive}
              onToggleInactive={actions.onToggleShowInactive}
              onSearchChange={actions.onSearchChange}
              onMoveType={actions.onMoveType}
            />
          </div>
          <div className="flex-1 min-w-0">
            <TypeEditorPanel
              form={model.form}
              isCreating={model.isCreating}
              saving={model.saving}
              error={model.error}
              staffOptions={model.staffOptions}
              locationOptions={model.locationOptions}
              connectedPaymentProviders={model.connectedPaymentProviders}
              namedScheduleOptions={model.namedScheduleOptions}
              teamGroupOptions={model.teamGroupOptions}
              resourceOptions={model.resourceOptions}
              addOnOptions={model.addOnOptions}
              categoryOptions={model.categoryOptions}
              intakeFormOptions={model.intakeFormOptions}
              appointmentTypeId={model.selectedId}
              onFormChange={actions.onFormChange}
              onSave={actions.onSave}
              onCancel={actions.onCancel}
              onBack={actions.onBackToList}
              onManageAvailability={actions.onManageAvailability}
              onManageStaff={actions.onManageStaff}
              onManageLocations={actions.onManageLocations}
            />
          </div>
          {selected ? (
            <div className="w-[300px] shrink-0 space-y-4">
              <PreviewPanel type={selected} />
              <StatusPanel
                type={selected}
                workspaceSlug={model.workspaceSlug}
                copied={model.copiedId === selected.id}
                onToggleActive={actions.onToggleActive}
                onCopyLink={() => actions.onCopyLink(selected.id)}
                onViewBookingPage={actions.onViewBookingPage}
              />
            </div>
          ) : null}
        </div>
        <TypeBulkEditPanel
          types={model.types.map((t) => ({ id: t.id, name: t.name }))}
          onApplied={actions.onRetry}
        />
      </div>
    </div>
  );
}
