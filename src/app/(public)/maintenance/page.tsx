import { getMaintenanceState } from "@/lib/platform-flags";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  let message =
    "We're performing scheduled maintenance. Please try again shortly.";
  try {
    const state = await getMaintenanceState();
    if (state.message?.trim()) message = state.message;
  } catch {
    // keep default
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-white">
      <div className="max-w-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-300">
          Transovo AI
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">We’ll be right back</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-300">{message}</p>
      </div>
    </div>
  );
}
