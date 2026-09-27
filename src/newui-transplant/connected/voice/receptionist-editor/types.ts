export type ReceptionistEditorStage = "identity" | "responsibilities" | "review";

export const RECEPTIONIST_EDITOR_STAGES: Array<{
  id: ReceptionistEditorStage;
  index: string;
  title: string;
}> = [
  { id: "identity", index: "01", title: "Identity & Conversation" },
  { id: "responsibilities", index: "02", title: "Responsibilities & Call Flow" },
  { id: "review", index: "03", title: "Review & Test" },
];
