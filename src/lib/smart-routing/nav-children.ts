/** Smart Routing sidebar children (shared by MCTB, Numbers, and Personal nav). */
export function buildSmartRoutingNavChildren(flowId?: string | null) {
  const fid = flowId ?? null;
  return [
    { label: "Overview", href: "/smart-routing" },
    { label: "Create Flow", href: "/smart-routing/new" },
    {
      label: "Call Flow Builder",
      href: fid ? `/smart-routing/${fid}` : "/smart-routing",
    },
    { label: "Audio", href: "/smart-routing/audio" },
    {
      label: "Test & Activate",
      href: fid ? `/smart-routing/${fid}/test` : "/smart-routing",
    },
    {
      label: "Activity",
      href: fid ? `/smart-routing/${fid}/activity` : "/smart-routing",
    },
  ];
}
