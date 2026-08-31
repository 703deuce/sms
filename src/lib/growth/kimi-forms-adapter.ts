/**
 * Data adapter: maps /api/growth/forms ↔ Kimi grow-forms mock types.
 */
import type { WebForm } from "@/components/kimi/grow-forms/mock-data";
import type { FormLayout } from "@/lib/forms/layout";

function formatSaved(iso?: string): string {
  if (!iso) return "Recently";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Recently";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function mapOptInFormToKimi(f: {
  id: string;
  name: string;
  listName?: string | null;
  status?: string;
  url?: string | null;
  updatedAt?: string;
  createdAt?: string;
}): WebForm {
  return {
    id: f.id,
    name: f.name,
    description: f.listName || "",
    type: "Landing Page",
    connectedLists: f.listName ? 1 : 0,
    status: f.status === "Inactive" ? "Inactive" : "Active",
    lastSaved: formatSaved(f.updatedAt || f.createdAt),
    thumb: "forest",
  };
}

export async function fetchWebForms(): Promise<WebForm[]> {
  const res = await fetch("/api/growth/forms");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load forms");
  return (json.data || []).map(mapOptInFormToKimi);
}

export async function createWebForm(name: string): Promise<WebForm> {
  const res = await fetch("/api/growth/forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not create form");
  return mapOptInFormToKimi(json.data);
}

export async function deleteWebForm(id: string): Promise<void> {
  const res = await fetch(`/api/growth/forms/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || "Could not delete form");
  }
}

export async function updateWebForm(
  id: string,
  payload: {
    name?: string;
    listName?: string;
    doubleOptIn?: boolean;
    status?: string;
    fields?: string[];
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    disclosureText?: string;
    thankYouMessage?: string;
    optInMessage?: string;
    doubleOptInMessage?: string;
    layout?: FormLayout;
    customCss?: string;
    customJs?: string;
    contactMode?: "create" | "update";
    description?: string;
    urlPath?: string;
    successHeadline?: string;
    successMessage?: string;
    branding?: {
      primaryColor?: string;
      accentColor?: string;
      theme?: string;
      logoUrl?: string;
    };
  },
): Promise<WebForm> {
  const res = await fetch(`/api/growth/forms/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not save form");
  return mapOptInFormToKimi(json.data);
}

export async function fetchWebFormById(id: string): Promise<{
  id: string;
  name: string;
  listName?: string | null;
  doubleOptIn?: boolean;
  status?: string;
  config?: {
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    fields?: string[];
    optInMessage?: string;
    doubleOptInMessage?: string;
    layout?: FormLayout;
    customCss?: string;
    customJs?: string;
    contactMode?: "create" | "update";
    description?: string;
    urlPath?: string;
    successHeadline?: string;
    successMessage?: string;
    branding?: {
      primaryColor?: string;
      accentColor?: string;
      theme?: string;
      logoUrl?: string;
    };
  };
  disclosureText?: string | null;
  thankYouMessage?: string | null;
}> {
  const res = await fetch(`/api/growth/forms/${id}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not load form");
  return json.data;
}

export async function fetchContactListNames(): Promise<string[]> {
  const res = await fetch("/api/contacts/lists");
  const json = await res.json();
  if (!res.ok) return [];
  return (json.data || []).map((l: { name: string }) => l.name);
}
