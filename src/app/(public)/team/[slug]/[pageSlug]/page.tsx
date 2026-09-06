import { PublicTeamBookClient } from "@/components/appointments/public-team-book-client";

type Props = { params: Promise<{ slug: string; pageSlug: string }> };

export default async function PublicTeamBookPage({ params }: Props) {
  const { slug, pageSlug } = await params;
  return <PublicTeamBookClient workspaceSlug={slug} pageSlug={pageSlug} />;
}
