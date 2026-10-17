export type SelectedMaterialRef = {
  materialId?: string;
  category: string;
  name?: string;
};

export type GenerationPreserveFlags = {
  camera_viewpoint?: boolean;
  window?: boolean;
  door_positions?: boolean;
  ceiling?: boolean;
  untargeted_vanity?: boolean;
  room_proportions?: boolean;
};

export function buildVisualizerEditPrompt(input: {
  transformation: string;
  selectedMaterials: SelectedMaterialRef[];
  additionalInstructions?: string | null;
  preserve?: GenerationPreserveFlags;
  isRevision?: boolean;
}): string {
  const transformation = String(input.transformation);
  const preserve = input.preserve ?? {
    camera_viewpoint: true,
    window: true,
    door_positions: true,
    ceiling: true,
    untargeted_vanity: true,
    room_proportions: true,
  };

  const transformLine =
    transformation === "TUB_TO_SHOWER"
      ? "Replace the existing bathtub with a realistic walk-in shower conversion using the supplied wall-panel and fixture reference images."
      : transformation === "SHOWER_REPLACEMENT"
        ? "Replace the existing shower enclosure, wall surfaces, and base using the supplied product reference images while keeping the same shower location."
        : transformation === "WALL_PANEL_UPGRADE"
          ? "Upgrade the targeted shower or bath wall surfaces to match the supplied wall-panel reference images."
          : transformation === "BATHROOM_REFRESH"
            ? "Refresh vanity, flooring, fixtures, and finishes as described while preserving overall room layout."
            : "Apply the requested bathroom remodel concept using supplied reference images.";

  const materialNames = input.selectedMaterials
    .map((m) => m.name || m.category)
    .filter(Boolean)
    .join(", ");

  const preserveParts: string[] = [];
  if (preserve.camera_viewpoint) preserveParts.push("camera viewpoint and framing");
  if (preserve.window) preserveParts.push("window location");
  if (preserve.door_positions) preserveParts.push("door positions");
  if (preserve.ceiling) preserveParts.push("ceiling");
  if (preserve.untargeted_vanity) preserveParts.push("untargeted vanity and toilet unless explicitly changed");
  if (preserve.room_proportions) preserveParts.push("room proportions and recognizable architecture");

  const revisionPrefix = input.isRevision
    ? "Revise the previous concept: keep the same bathroom composition and viewpoint. "
    : "";

  const materialsLine = materialNames
    ? `Use the appearance of these selected products in the remodel: ${materialNames}.`
    : "Match the supplied material reference images for surface appearance.";

  const extra = input.additionalInstructions?.trim()
    ? ` Additional instructions: ${input.additionalInstructions.trim()}`
    : "";

  return (
    `${revisionPrefix}Transform the provided original bathroom photograph into a photorealistic remodel concept. ` +
    `${transformLine} ` +
    `${materialsLine} ` +
    `Preserve ${preserveParts.join(", ")}. ` +
    "Use realistic lighting, plausible proportions, and professional installation styling. " +
    "Do not invent a different room layout or move fixed structural features. " +
    "This is a sales concept visualization, not a construction blueprint." +
    extra
  );
}
