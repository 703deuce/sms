/**
 * Reusable solution → AutomationFlow generator contract.
 *
 * Missed Call Text Back is the reference implementation
 * (`src/lib/solutions/missed-call-text-back/`). Remaining wizards should
 * migrate onto this pattern one at a time — do not wire all solutions here yet.
 */

import type { AutomationDefinition } from "@/lib/automations/types";

export type SolutionGeneratorResult = {
  setupId: string;
  flowId: string;
  advancedCustomized: boolean;
  created: boolean;
};

export type SolutionGenerator<TConfig> = {
  solutionType: string;
  externalKey: string;
  buildDefinition: (config: TConfig) => AutomationDefinition;
  applyWizardConfig: (
    existing: unknown,
    config: TConfig,
  ) => { definition: AutomationDefinition; advancedCustomized: boolean };
  detectAdvancedCustomization: (definition: unknown) => boolean;
  configFromDefinition: (definition: unknown, fallback: TConfig) => TConfig;
  save: (
    workspaceId: string,
    input: Partial<TConfig> & { setupId?: string },
  ) => Promise<SolutionGeneratorResult>;
  load: (
    workspaceId: string,
    setupId?: string,
  ) => Promise<{
    setupId: string | null;
    flowId: string | null;
    config: TConfig;
    advancedCustomized: boolean;
    status: string;
  } | null>;
};

export {
  saveMissedCallTextBack,
  loadMissedCallTextBack,
} from "@/lib/solutions/missed-call-text-back/save";
export { SOLUTION_TYPE as MISSED_CALL_TEXT_BACK_SOLUTION_TYPE } from "@/lib/solutions/missed-call-text-back/types";
