export function isDevBypassEnabled(): boolean {
  return process.env.DEV_BYPASS_AUTH === "true" || process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";
}

export function isDevMockAuthEnabled(): boolean {
  return isDevBypassEnabled();
}

export function isDevPreviewBusiness(businessId: string): boolean {
  return businessId === "preview" || businessId.startsWith("dev-");
}

export function getDevAuthContext() {
  return {
    userId: process.env.DEV_USER_ID ?? "dev-user",
    organizationId: process.env.DEV_WORKSPACE_ID ?? "dev-workspace",
    email: "dev@localhost",
    isAuthenticated: true,
  };
}
