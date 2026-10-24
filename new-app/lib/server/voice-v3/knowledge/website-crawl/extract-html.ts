export type ExtractedPage = {
  pageTitle: string;
  text: string;
  canonicalUrl: string | null;
};

export function extractReadableContentFromHtml(html: string, pageUrl: string): ExtractedPage {
  let canonicalUrl: string | null = null;
  const canonMatch = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  );
  if (canonMatch?.[1]) {
    try {
      canonicalUrl = new URL(canonMatch[1], pageUrl).toString();
    } catch {
      canonicalUrl = null;
    }
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch?.[1]?.trim() || pageUrl;

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  body = body.replace(/<\/(p|div|h1|h2|h3|h4|li|tr)>/gi, "\n");
  body = body.replace(/<[^>]+>/g, " ");
  body = body
    .replace(/\s+/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();

  return { pageTitle, text: body.slice(0, 120_000), canonicalUrl };
}
