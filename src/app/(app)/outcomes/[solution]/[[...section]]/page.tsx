import { OutcomePageView } from "@/components/outcomes/outcome-page";
import { loadOutcomeInstances } from "@/lib/outcomes/instances";
import {
  getOutcomePage,
  getOutcomeSolution,
} from "@/lib/outcomes/registry";
import { requireWorkspaceContext } from "@/lib/workspace-data";
import { notFound } from "next/navigation";

export default async function OutcomeSolutionPage({
  params,
  searchParams,
}: {
  params: Promise<{ solution: string; section?: string[] }>;
  searchParams: Promise<{ channel?: string }>;
}) {
  const { solution: solutionSlug, section } = await params;
  const { channel } = await searchParams;
  const solution = getOutcomeSolution(solutionSlug);
  if (!solution) notFound();

  const sectionSlug = section?.[0];
  // Only one section segment is used today (e.g. /outcomes/x/setup).
  if (section && section.length > 1) notFound();

  const page = getOutcomePage(solution, sectionSlug);
  if (!page) notFound();

  const { workspaceId } = await requireWorkspaceContext();
  const instancesBySolution = await loadOutcomeInstances(workspaceId);
  const instances = instancesBySolution[solution.slug] ?? [];

  return (
    <OutcomePageView
      solution={solution}
      page={page}
      instances={instances}
      channel={channel}
    />
  );
}
