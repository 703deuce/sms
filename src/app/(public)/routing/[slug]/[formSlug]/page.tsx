import { PublicRoutingFormClient } from "@/components/appointments/public-routing-form-client";

type Props = { params: Promise<{ slug: string; formSlug: string }> };

export default async function PublicRoutingFormPage({ params }: Props) {
  const { slug, formSlug } = await params;
  return <PublicRoutingFormClient workspaceSlug={slug} formSlug={formSlug} />;
}
