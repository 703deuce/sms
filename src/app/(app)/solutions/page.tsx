import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { solutionCategories } from "@/lib/solutions-catalog";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Legacy Solution Center catalog. The primary Solutions experience now lives
 * under /outcomes (Solutions navigation view). This page remains for deep links.
 */
export default function SolutionsHubPage() {
  return (
    <div>
      <PageHeader
        title="Solution Center"
        description="Guided setups over Messaging, Voice, Automations, Contacts, and Reports. Prefer the Solutions navigation view for outcome-based management after setup."
        actions={
          <Link href="/outcomes">
            <Button size="sm" className="gap-1.5">
              Open Solutions view
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {solutionCategories.map((category) => (
          <Card key={category.slug} className="flex flex-col">
            <CardTitle>{category.title}</CardTitle>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{category.summary}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {category.solutions.map((solution) => (
                <li key={solution.slug}>
                  <Link
                    href={solution.href}
                    className="text-foreground underline-offset-2 hover:text-primary hover:underline"
                  >
                    {solution.title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <Link href={category.href}>
                <Button variant="outline" size="sm" className="gap-1.5">
                  Browse {category.title}
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
