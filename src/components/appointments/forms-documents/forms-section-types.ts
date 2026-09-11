export type FormsSectionId =
  | "library"
  | "assignments"
  | "submissions"
  | "completion"
  | "documents"
  | "settings";

export const FORMS_SECTIONS: Array<{ id: FormsSectionId; label: string; description: string }> = [
  { id: "library", label: "Library", description: "Reusable forms and intake assets." },
  { id: "assignments", label: "Assignments", description: "Which offerings require each form." },
  { id: "submissions", label: "Submissions", description: "Customer responses and files." },
  { id: "completion", label: "Completion", description: "Pending signatures and documents." },
  { id: "documents", label: "Documents", description: "Waivers, agreements, and contracts." },
  { id: "settings", label: "Settings", description: "Platform terms and defaults." },
];

export type FormDetailSectionId =
  | "overview"
  | "assignments"
  | "completion"
  | "submissions"
  | "versions"
  | "advanced";

export const FORM_DETAIL_SECTIONS: Array<{ id: FormDetailSectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "assignments", label: "Assignments" },
  { id: "completion", label: "Completion rules" },
  { id: "submissions", label: "Submissions" },
  { id: "versions", label: "Versions" },
  { id: "advanced", label: "Advanced" },
];
