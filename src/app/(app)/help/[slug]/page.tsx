import { isMctbV1Primary } from "@/lib/workspace/platform-launch";
import { getMctbHelpArticle, mctbHelpArticleSlugs } from "@/lib/mctb/help-articles";
import { MctbHelpArticleView } from "@/newui-transplant/connected/mctb/mctb-help-article-view";
import { notFound, redirect } from "next/navigation";

export function generateStaticParams() {
  return mctbHelpArticleSlugs().map((slug) => ({ slug }));
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isMctbV1Primary()) {
    redirect("/getting-started");
  }
  const { slug } = await params;
  const article = getMctbHelpArticle(slug);
  if (!article) notFound();
  return <MctbHelpArticleView article={article} />;
}
