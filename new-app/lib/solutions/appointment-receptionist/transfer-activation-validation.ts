import "server-only";

import { compileVoiceV3TransferPolicyFromWizard } from "@/lib/voice-v3/transfer/compile-transfer-config";
import { validateVoiceV3TransferPolicyForPublish } from "@/lib/voice-v3/transfer/validate-transfer-publish";
import type { AppointmentReceptionistWizardState } from "./types";
import type { ActivationIssue } from "./capability-checklist";
import { normalizeWizardTransferPhone } from "./transfer-utils";
import { transferWizardValidationIssues } from "./transfer-wizard-state";

/** Server-only transfer activation gates (includes compiled publish validation). */
export function transferActivationIssues(
  state: AppointmentReceptionistWizardState,
): ActivationIssue[] {
  if (!state.capabilities.includes("transfer_calls")) return [];

  const issues: ActivationIssue[] = [];
  for (const row of transferWizardValidationIssues(state)) {
    const blocking =
      row.id !== "transfer_ui_warm_requires_platform";
    issues.push({
      id: row.id,
      severity: blocking ? "blocking" : "warning",
      message: row.message,
    });
  }

  const hasDestRow = (state.transferDestinations ?? []).some(
    (d) => d.enabled !== false && Boolean(d.phoneE164?.trim()),
  );
  const legacyPhone = normalizeWizardTransferPhone(state.transferDestinationPhone);
  if (!hasDestRow && !legacyPhone) {
    return issues;
  }

  const policy = compileVoiceV3TransferPolicyFromWizard(state);
  for (const issue of validateVoiceV3TransferPolicyForPublish(policy, true)) {
    if (!issues.some((i) => i.id === issue.id)) {
      issues.push({
        id: issue.id,
        severity: "blocking",
        message: issue.message,
      });
    }
  }
  return issues;
}
