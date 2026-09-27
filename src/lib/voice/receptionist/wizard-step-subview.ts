import type { WizardStepId } from "@/lib/solutions/appointment-receptionist/types";
import {
  RECEPTIONIST_WIZARD_EDIT_PATH,
  receptionistStepQueryFromId,
} from "@/lib/voice/receptionist/wizard-step-url";

export type InformationSubView = "setup" | "gaps" | "sources";
export type CallHandlingSubView = "setup" | "transfers" | "routing";

const INFORMATION_VIEWS: InformationSubView[] = ["setup", "gaps", "sources"];
const CALL_HANDLING_VIEWS: CallHandlingSubView[] = ["setup", "transfers", "routing"];

export function parseInformationSubView(raw: string | null | undefined): InformationSubView {
  const v = raw?.trim().toLowerCase();
  if (v && INFORMATION_VIEWS.includes(v as InformationSubView)) {
    return v as InformationSubView;
  }
  return "setup";
}

export function parseCallHandlingSubView(raw: string | null | undefined): CallHandlingSubView {
  const v = raw?.trim().toLowerCase();
  if (v && CALL_HANDLING_VIEWS.includes(v as CallHandlingSubView)) {
    return v as CallHandlingSubView;
  }
  return "setup";
}

export function buildReceptionistEditHref(
  current: URLSearchParams | string | null | undefined,
  patch: {
    step: WizardStepId;
    view?: InformationSubView | CallHandlingSubView | null;
  },
): string {
  const params = new URLSearchParams(
    typeof current === "string" ? current : current?.toString() || "",
  );
  params.set("step", receptionistStepQueryFromId(patch.step));
  if (patch.view === null || patch.view === "setup") {
    params.delete("view");
  } else if (patch.view) {
    params.set("view", patch.view);
  }
  return `${RECEPTIONIST_WIZARD_EDIT_PATH}?${params.toString()}`;
}

export const INFORMATION_SUB_NAV: Array<{ id: InformationSubView; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "gaps", label: "Knowledge gaps" },
  { id: "sources", label: "Sources" },
];

export const CALL_HANDLING_SUB_NAV: Array<{ id: CallHandlingSubView; label: string }> = [
  { id: "setup", label: "Setup" },
  { id: "transfers", label: "Recent transfers" },
  { id: "routing", label: "Routing" },
];
