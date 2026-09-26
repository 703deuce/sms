import type { BusinessContext } from "@/newui-transplant/lib/view-models";

export function businessContextFromWorkspace(input: {
  name: string;
  businessLineE164?: string | null;
  senderE164?: string | null;
  timezone?: string | null;
  website?: string | null;
}): BusinessContext {
  return {
    name: input.name,
    line: input.businessLineE164?.trim() || "—",
    sender: input.senderE164?.trim() || "—",
    timezone: input.timezone?.trim() || "America/Chicago",
    website: input.website?.trim() || "",
  };
}
