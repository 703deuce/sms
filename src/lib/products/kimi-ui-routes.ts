/**
 * Routes promoted from Kimi drafts (mock UI shell). Used for full-bleed layout and
 * hiding duplicate Transovo page chrome so reference.css renders like Kimi preview.
 */

export const KIMI_INTEGRATED_ROUTE_PREFIXES = [
  "/auto-replies",
  "/campaigns",
  "/contacts",
  "/conversations",
  "/grow/keywords",
  "/grow/qr-codes",
  "/grow/tap-to-join",
  "/messaging/media",
] as const;

export function isKimiIntegratedRoute(pathname: string): boolean {
  return KIMI_INTEGRATED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** CSS wrapper class for a Kimi-integrated route (matches integrate-kimi-ui JOBS). */
export function kimiRouteScopeClass(pathname: string): string | null {
  if (pathname === "/auto-replies" || pathname.startsWith("/auto-replies/")) {
    return "kimi-auto-replies";
  }
  if (pathname === "/campaigns" || pathname.startsWith("/campaigns/")) {
    return "kimi-campaigns";
  }
  if (pathname === "/contacts/fields" || pathname.startsWith("/contacts/fields/")) {
    return "kimi-contacts-fields";
  }
  if (pathname === "/contacts/lists" || pathname.startsWith("/contacts/lists/")) {
    return "kimi-contacts-lists";
  }
  if (pathname === "/contacts" || pathname.startsWith("/contacts/")) {
    return "kimi-contacts";
  }
  if (pathname === "/conversations" || pathname.startsWith("/conversations/")) {
    return "kimi-conversations";
  }
  if (pathname === "/grow/keywords" || pathname.startsWith("/grow/keywords/")) {
    return "kimi-grow-keywords";
  }
  if (pathname === "/grow/qr-codes" || pathname.startsWith("/grow/qr-codes/")) {
    return "kimi-grow-qr-codes";
  }
  if (pathname === "/grow/tap-to-join" || pathname.startsWith("/grow/tap-to-join/")) {
    return "kimi-grow-tap-to-join";
  }
  if (pathname === "/messaging/media" || pathname.startsWith("/messaging/media/")) {
    return "kimi-messaging-media";
  }
  return null;
}
