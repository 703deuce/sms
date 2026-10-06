"use client";

import Link from "next/link";
import type { MctbHelpArticle, MctbHelpBlock } from "@/lib/mctb/help-articles";
import { Page, PageHeader, Panel, TextLink } from "@/newui-transplant/components/app/kit";
import { Button } from "@/newui-transplant/components/ui/button";

function RenderBlock({ block }: { block: MctbHelpBlock }) {
  switch (block.type) {
    case "h2":
      return <h2 className="mt-6 text-base font-semibold first:mt-0">{block.text}</h2>;
    case "p":
      return <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
    case "ul":
      return (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      );
    default:
      return null;
  }
}

export function MctbHelpArticleView({ article }: { article: MctbHelpArticle }) {
  return (
    <Page className="max-w-3xl">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Link href="/help" className="hover:underline">Help</Link>
        <span aria-hidden="true"> / </span>
        <span>{article.category}</span>
      </p>
      <PageHeader
        title={article.title}
        description={article.description}
        actions={
          <Button variant="outline" size="sm" render={<Link href={article.configureHref} />}>
            {article.configureLabel}
          </Button>
        }
      />
      <Panel>
        {article.blocks.map((block, i) => (
          <RenderBlock key={`${block.type}-${i}`} block={block} />
        ))}
        <p className="mt-8 border-t pt-4 text-sm">
          <TextLink href={article.configureHref}>{article.configureLabel} →</TextLink>
        </p>
      </Panel>
      <p className="mt-6 text-sm text-muted-foreground">
        <TextLink href="/help">← All help articles</TextLink>
      </p>
    </Page>
  );
}
