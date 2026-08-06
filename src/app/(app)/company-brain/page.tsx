import { CompanyBrainSetup } from "@/components/hire/company-brain-setup";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

/** Persistent Company Brain editor (shared knowledge for all agents). */
export default async function CompanyBrainPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/company-brain");
  return (
    <div>
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm sm:px-8">
        <Link href="/agents" className="font-medium text-blue-600">
          ← Your Team
        </Link>
        <span className="mx-2 text-slate-300">·</span>
        <span className="text-slate-600">Company Brain</span>
      </div>
      <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
        <CompanyBrainSetup />
      </Suspense>
    </div>
  );
}
