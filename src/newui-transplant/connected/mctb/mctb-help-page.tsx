"use client";

import Link from "next/link";
import { Page, PageHeader, TextLink } from "@/newui-transplant/components/app/kit";
import { OPUS_INSET_LIST } from "@/newui-transplant/components/app/opus-surfaces";
import {
  listMctbHelpArticles,
  type MctbHelpArticleCategory,
} from "@/lib/mctb/help-articles";

const CATEGORY_ORDER: MctbHelpArticleCategory[] = [
  "Setup",
  "Recovery",
  "Compliance",
  "Operations",
  "Account",
];

function articlesByCategory() {
  const articles = listMctbHelpArticles();
  const map = new Map<MctbHelpArticleCategory, typeof articles>();
  for (const cat of CATEGORY_ORDER) {
    map.set(cat, articles.filter((a) => a.category === cat));
  }
  return map;
}

export function MctbHelpPage() {
  const grouped = articlesByCategory();

  return (
    <Page className="max-w-3xl">
      <PageHeader
        title="Help"
        description="Guides for setup, recovery, compliance, and day-to-day use of Missed Call Text Back."
        actions={<TextLink href="/getting-started">Getting started checklist →</TextLink>}
      />

      {CATEGORY_ORDER.map((category) => {
        const items = grouped.get(category) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={category} className="mb-8">
            <h2 className="text-sm font-semibold">{category}</h2>
            <ul className={`${OPUS_INSET_LIST} mt-3 text-sm`}>
              {items.map((article) => (
                <li key={article.slug} className="px-4 py-3">
                  <Link href={`/help/${article.slug}`} className="font-medium hover:underline">
                    {article.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">{article.description}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </Page>
  );
}
