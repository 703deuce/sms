import Link from "next/link";
import { Hash, MessageSquare, ArrowRight } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getUserProductAccess } from "@/lib/products/entitlements";
import { productHomePath } from "@/lib/products/types";
import { redirect } from "next/navigation";

export default async function ProductLauncherPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/app");

  const access = await getUserProductAccess(session.userId);
  const hasSms = access.hasSms;
  const hasNumbers = access.hasNumbers;

  return (
    <div className="mx-auto max-w-3xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Your Transovo Products
        </h1>
        <p className="mt-2 text-muted-foreground">Choose what you&apos;d like to manage.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ProductCard
          icon={<MessageSquare className="h-6 w-6" />}
          title="Transovo SMS"
          description="Business texting, campaigns, automations, and customer conversations."
          href={hasSms ? productHomePath("sms") : "/sms-marketing"}
          actionLabel={hasSms ? "Open SMS" : "Explore SMS"}
          entitled={hasSms}
        />
        <ProductCard
          icon={<Hash className="h-6 w-6" />}
          title="Transovo Numbers"
          description="Find, manage, forward, vault, and transfer your phone numbers."
          href={hasNumbers ? productHomePath("numbers") : "/personal/numbers/premium"}
          actionLabel={hasNumbers ? "Open Numbers" : "Find a Number"}
          entitled={hasNumbers}
        />
      </div>
    </div>
  );
}

function ProductCard({
  icon,
  title,
  description,
  href,
  actionLabel,
  entitled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  entitled: boolean;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        {actionLabel}
        <ArrowRight className="h-4 w-4" />
      </Link>
      {!entitled ? (
        <p className="mt-2 text-xs text-muted-foreground">Get started with Transovo {title.split(" ")[1]}</p>
      ) : null}
    </div>
  );
}
