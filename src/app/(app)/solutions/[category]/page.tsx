import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getSolutionCategory } from "@/lib/solutions-catalog";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SolutionCategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: categorySlug } = await params;
  const category = getSolutionCategory(categorySlug);
  if (!category) notFound();

  return (
    <div>
      <PageHeader
        title={category.title}
        description={category.summary}
        actions={
          <Link href="/solutions">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Solution Center
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {category.solutions.map((solution) => (
          <Card key={solution.slug} className="flex flex-col">
            <CardTitle>{solution.title}</CardTitle>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{solution.summary}</p>
            <div className="mt-4">
              <Link href={solution.href}>
                <Button size="sm" className="gap-1.5">
                  Open solution
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
