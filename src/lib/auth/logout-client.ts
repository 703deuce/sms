/** Clear server session cookies and return to login (client-side). */
export async function performClientLogout(redirectTo = "/login"): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  window.location.assign(redirectTo);
}
