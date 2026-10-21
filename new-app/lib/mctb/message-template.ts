export function renderMctbMessageTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    const snake = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    out = out.replaceAll(`{{${key}}}`, value);
    out = out.replaceAll(`{{${snake}}}`, value);
  }
  return out.replace(/\{\{[^}]+\}\}/g, "").trim();
}
