export { mockSetupPageModel } from "@/features/appointments/kimi/fixtures/setup/mock-data";

import { mockSetupPageModel } from "@/features/appointments/kimi/fixtures/setup/mock-data";

export const setupSteps = mockSetupPageModel.steps;
export const progressSummary = mockSetupPageModel.progress;
export const readinessItems = mockSetupPageModel.readinessItems;
export const bookingLink = mockSetupPageModel.bookingLink;
export const quickTips = mockSetupPageModel.quickTips;

export type { SetupStep, SetupStepStatus } from "@/features/appointments/kimi/setup/types";
