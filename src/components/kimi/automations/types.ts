/** Kimi session 2026-08-30T23-46-59-898Z-59452d — list row shape for WorkflowsList */
export type KimiWorkflowRow = {
  id: string;
  name: string;
  description: string;
  lastSaved: string;
  currentContacts: number;
  clicks: number;
  unsubscribes: number;
  revenue: string;
  status: "Active" | "Inactive";
};
