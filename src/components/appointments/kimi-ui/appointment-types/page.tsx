"use client";

import { Plus, ExternalLink } from "lucide-react";
import TypeListPanel from "./components/TypeListPanel";
import TypeEditorPanel from "./components/TypeEditorPanel";
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
      <div className="max-w-[1560px] mx-auto px-8 py-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-bold tracking-tight">Appointment Types</h1>
            <p className="text-[13.5px] text-[#8a8fa3] mt-1">
              Manage the services you offer and how customers can book with you.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 text-[13px] font-medium px-4 py-2.5 rounded-lg border border-[#e4e6ee] bg-white hover:bg-[#f7f8fb]"
              onClick={actions.onViewBookingPage}
              disabled={!model.bookingBaseUrl}
            >
              View booking page <ExternalLink size={14} />
            </button>
            <button
              type="button"
              className="btn-brand flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-lg"
              onClick={actions.onNewType}
            >
              <Plus size={15} /> New appointment type
            </button>
          </div>
        </div>

        <div className="flex gap-5 items-start">
          <div className="self-stretch flex">
            <TypeListPanel
              types={model.visibleTypes}
              totalCount={model.types.length}
              selectedId={model.selectedId}
              searchQuery={model.searchQuery}
              onSelect={actions.onSelectType}
              showInactive={model.showInactive}
              onToggleInactive={actions.onToggleShowInactive}
              onSearchChange={actions.onSearchChange}
            />
          </div>
          <TypeEditorPanel
            form={model.form}
            isCreating={model.isCreating}
            saving={model.saving}
            error={model.error}
            onFormChange={actions.onFormChange}
            onSave={actions.onSave}
            onCancel={actions.onCancel}
            onBack={actions.onBackToList}
            onManageAvailability={actions.onManageAvailability}
          />
          {selected ? (
            <div className="w-[300px] shrink-0 space-y-5">
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
      </div>
    </div>
  );
}
