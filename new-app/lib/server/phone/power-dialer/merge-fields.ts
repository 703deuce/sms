export type MergeContext = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phone?: string | null;
  repName?: string | null;
  customFields?: Record<string, unknown> | null;
};

export function renderMergeTemplate(body: string, ctx: MergeContext): string {
  const custom =
    ctx.customFields && typeof ctx.customFields === "object" ? ctx.customFields : {};
  const map: Record<string, string> = {
    first_name: ctx.firstName || "",
    last_name: ctx.lastName || "",
    company: ctx.company || "",
    phone: ctx.phone || "",
    rep_name: ctx.repName || "",
  };
  for (const [k, v] of Object.entries(custom)) {
    map[k] = v == null ? "" : String(v);
  }
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => map[key] ?? "");
}
