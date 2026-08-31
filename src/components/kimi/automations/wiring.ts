import type { AutomationFlow } from "@/lib/types";

export async function reloadAutomations(): Promise<AutomationFlow[]> {
  const res = await fetch("/api/automations");
  if (!res.ok) throw new Error("Failed to load automations");
  const json = (await res.json()) as { data?: AutomationFlow[] };
  return json.data ?? [];
}
