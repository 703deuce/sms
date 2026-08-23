import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient as createSsrBrowserClient } from "@supabase/ssr";

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let browserClient: SupabaseClient | null = null;

function createMockBrowserClient(): SupabaseClient {
  const channel = {
    on: () => channel,
    subscribe: () => ({ data: { subscription: {} } }),
  };
  return {
    channel: () => channel,
    removeChannel: async () => ({ error: null }),
  } as unknown as SupabaseClient;
}

export function createBrowserClient() {
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (
      process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
      process.env.DEV_USE_MOCK_DATA === "true"
    ) {
      browserClient = createMockBrowserClient();
      return browserClient;
    }
    throw new Error("Missing Supabase public environment variables");
  }
  browserClient = createSsrBrowserClient(url, key);
  return browserClient;
}
