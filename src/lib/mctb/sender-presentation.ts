export type MctbSenderMode = "PLATFORM" | "WORKSPACE";

export function describeMctbSenderPresentation(mode: MctbSenderMode | string | null | undefined): {
  title: string;
  description: string;
} {
  if (mode === "PLATFORM") {
    return {
      title: "Transovo-managed messaging",
      description:
        "Recovery messages are sent using a Transovo-managed number. Message wording follows approved recovery templates.",
    };
  }
  return {
    title: "Your connected messaging number",
    description:
      "Recovery messages are sent using your approved business messaging number when messaging is ready.",
  };
}
