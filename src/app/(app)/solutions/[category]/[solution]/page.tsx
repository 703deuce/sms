import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSolution } from "@/lib/solutions-catalog";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<{ category: string; solution: string }>;
}) {
  const { category: categorySlug, solution: solutionSlug } = await params;
  const result = getSolution(categorySlug, solutionSlug);
  if (!result) notFound();

  const { category, solution } = result;

  return (
    <div>
      <PageHeader
        title={solution.title}
        description={solution.summary}
        actions={
          <>
            <Link href={category.href}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                {category.title}
              </Button>
            </Link>
            {solution.cta ? (
              <Link href={solution.cta.href}>
                <Button size="sm" className="gap-1.5">
                  {solution.cta.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            ) : null}
          </>
        }
      />

      <Card>
        <CardTitle>Built on your existing tools</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          This solution configures capabilities you already have. Use the links below to jump
          into the underlying Messaging, Voice, Automations, Contacts, or Reports pages.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {solution.uses.map((use) => (
            <li key={use.href} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <span className="text-sm font-medium text-foreground">{use.label}</span>
              <Link href={use.href}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
