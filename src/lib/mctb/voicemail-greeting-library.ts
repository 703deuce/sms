import type { PersonalVoicemailBox } from "@/lib/personal/voicemail-mappers";

export type GreetingLibraryEntry = {
  id: string;
  label: string;
  status: "Active" | "Inactive";
  detail: string;
  previewUrl: string | null;
};

export function buildMctbGreetingLibrary(box: PersonalVoicemailBox | null): GreetingLibraryEntry[] {
  const hasAudio = Boolean(box?.greetingUrl);
  const hasText = Boolean(box?.greetingText?.trim());
  const activeId = hasAudio ? "audio" : hasText ? "text" : "default";

  const entries: GreetingLibraryEntry[] = [
    {
      id: "default",
      label: "Default Transovo greeting",
      status: activeId === "default" ? "Active" : "Inactive",
      detail: "System default script",
      previewUrl: null,
    },
  ];

  if (hasText) {
    entries.push({
      id: "text",
      label: "Personal greeting (script)",
      status: activeId === "text" && !hasAudio ? "Active" : hasAudio ? "Inactive" : "Active",
      detail: box?.greetingText?.slice(0, 48) || "Custom script",
      previewUrl: null,
    });
  }

  if (hasAudio) {
    entries.push({
      id: "audio",
      label: "Custom audio greeting",
      status: "Active",
      detail: "Recorded, uploaded, or generated",
      previewUrl: box?.greetingUrl || null,
    });
  }

  return entries;
}
