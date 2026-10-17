/** Transovo AI Remodel Visualizer — workspace routes */
export const VISUALIZER_ROUTES = {
  home: "/visualizer",
  projects: "/visualizer/projects",
  newDesign: "/visualizer/new",
  project: (id: string) => `/visualizer/projects/${id}`,
  design: (projectId: string, designId: string) =>
    `/visualizer/projects/${projectId}/design/${designId}`,
  materials: "/visualizer/materials",
  materialNew: "/visualizer/materials/new",
  material: (id: string) => `/visualizer/materials/${id}`,
  leads: "/visualizer/leads",
  widget: "/visualizer/widget",
  analytics: "/visualizer/analytics",
  settings: "/visualizer/settings",
  setup: "/visualizer/setup",
} as const;

export const VISUALIZER_PUBLIC_ROUTES = {
  hosted: (slug: string) => `/v/${slug}`,
  designShare: (slug: string, token: string) => `/v/${slug}/design/${token}`,
  estimateRequest: (slug: string, token: string) => `/v/${slug}/request/${token}`,
  embed: (publicKey: string) => `/embed/visualizer/${publicKey}`,
} as const;

export function isVisualizerPath(pathname: string): boolean {
  return pathname === "/visualizer" || pathname.startsWith("/visualizer/");
}
