"use client";

import { AppointmentTypesConnected } from "@/features/appointments/kimi/appointment-types/appointment-types-connected";
import { VOICE_SERVICE_BOOKABLE_CONFIG } from "@/lib/appointments/bookable-object-ia";

export function ServicesClient() {
  const config = VOICE_SERVICE_BOOKABLE_CONFIG.services;
  return (
    <AppointmentTypesConnected
      lockedKind={config.lockedKind}
      pageCopy={{
        pageTitle: config.pageTitle,
        pageDescription: config.pageDescription,
        createButtonLabel: config.createButtonLabel,
        listPanelTitle: config.listPanelTitle,
        listEmptyMessage: config.listEmptyMessage,
        editorBackLabel: config.editorBackLabel,
        hideKindPicker: true,
      }}
    />
  );
}
