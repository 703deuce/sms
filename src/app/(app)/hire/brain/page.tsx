import { CompanyBrainSetup } from "@/components/hire/company-brain-setup";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default async function HireBrainPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/hire/brain");
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading…</div>}>
      <CompanyBrainSetup />
    </Suspense>
  );
}
