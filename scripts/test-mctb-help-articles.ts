#!/usr/bin/env tsx
/**
 * MCTB in-app help articles — slug registry and routes.
 * Run: npx tsx scripts/test-mctb-help-articles.ts
 */
import assert from "node:assert/strict";
import {
  getMctbHelpArticle,
  listMctbHelpArticles,
  mctbHelpArticleSlugs,
} from "../src/lib/mctb/help-articles";

const slugs = mctbHelpArticleSlugs();
assert.ok(slugs.length >= 10, "expected full MCTB help catalog");

for (const slug of slugs) {
  const article = getMctbHelpArticle(slug);
  assert.ok(article, `missing article: ${slug}`);
  assert.equal(article.slug, slug);
  assert.ok(article.title.length > 3);
  assert.ok(article.blocks.length >= 3);
  assert.ok(article.configureHref.startsWith("/"));
}

assert.equal(getMctbHelpArticle("not-a-slug"), null);

const titles = new Set(listMctbHelpArticles().map((a) => a.title));
assert.equal(titles.size, slugs.length, "duplicate help titles");

console.log("test-mctb-help-articles: OK", slugs.length, "articles");
