import type { FormFieldKey, OptInFormConfig } from "@/lib/forms/types";
import { DEFAULT_DISCLOSURE } from "@/lib/forms/types";
import type { BlockStyle } from "@/lib/forms/block-styles";

export type FormBlockType =
  | "header"
  | "text"
  | "field"
  | "field-row"
  | "button"
  | "compliance"
  | "image-column"
  | "link"
  | "error";

export type FormBlock = {
  id: string;
  type: FormBlockType;
  props?: {
    content?: string;
    fieldKey?: FormFieldKey;
    fieldKeys?: FormFieldKey[];
    placeholder?: string;
    hidden?: boolean;
    imageHue?: string | null;
    imageUrl?: string | null;
    required?: boolean;
    defaultValue?: string;
    inputMode?: "standard" | "email" | "phone" | "numeric";
    style?: BlockStyle;
  };
};

export type FormLayout = {
  version: 1;
  formType: "landing" | "embed";
  imageHue?: string | null;
  description?: string;
  urlPath?: string;
  successHeadline?: string;
  successMessage?: string;
  contactMode?: "create" | "update";
  customCss?: string;
  customJs?: string;
  blocks: FormBlock[];
};

export const DEFAULT_SUCCESS_HEADLINE = "Check Your Texts";
export const DEFAULT_SUCCESS_MESSAGE =
  "We just sent you a message. Reply YES and we'll respond with your promo code.";

const FIELD_KEY_FROM_LABEL: Record<string, FormFieldKey> = {
  "First Name": "firstName",
  "Last Name": "lastName",
  "Mobile Number": "phone",
  Email: "email",
  Birthdate: "dateOfBirth",
};

export function fieldKeyFromLabel(label: string): FormFieldKey | undefined {
  return FIELD_KEY_FROM_LABEL[label];
}

export function labelFromFieldKey(key: FormFieldKey): string {
  const entry = Object.entries(FIELD_KEY_FROM_LABEL).find(([, v]) => v === key);
  return entry?.[0] || key;
}

function blockId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Build the default block tree from flat config (used when no layout is stored). */
export function defaultLayoutFromConfig(
  config: OptInFormConfig,
  formType: "landing" | "embed" = "landing",
): FormLayout {
  const fields = config.fields || ["firstName", "phone"];
  const hasLastName = fields.includes("lastName");
  const hasEmail = fields.includes("email");

  const blocks: FormBlock[] = [
    {
      id: blockId("header"),
      type: "header",
      props: { content: config.headline || "Want 20% off?", style: { textAlign: "center", fontSize: 28 } },
    },
    {
      id: blockId("text"),
      type: "text",
      props: {
        content:
          config.subheadline ||
          "Join our VIP text list and receive a code for your next purchase.",
        style: { textAlign: "center", fontSize: 12, color: "#cbd5e1" },
      },
    },
  ];

  if (hasLastName) {
    blocks.push({
      id: blockId("row"),
      type: "field-row",
      props: { fieldKeys: ["firstName", "lastName"] },
    });
  } else if (fields.includes("firstName")) {
    blocks.push({
      id: blockId("first"),
      type: "field",
      props: { fieldKey: "firstName", placeholder: "First Name" },
    });
  }

  blocks.push({
    id: blockId("phone"),
    type: "field",
    props: { fieldKey: "phone", placeholder: "Mobile Number", required: true },
  });

  if (hasEmail) {
    blocks.push({
      id: blockId("email"),
      type: "field",
      props: { fieldKey: "email", placeholder: "Email" },
    });
  }

  if (fields.includes("dateOfBirth")) {
    blocks.push({
      id: blockId("dob"),
      type: "field",
      props: { fieldKey: "dateOfBirth", placeholder: "Date of birth" },
    });
  }

  blocks.push({
    id: blockId("btn"),
    type: "button",
    props: {
      content: config.buttonLabel || "Join Now",
      style: { backgroundColor: "#4f46e5", color: "#ffffff", borderRadius: 6 },
    },
  });

  blocks.push({
    id: blockId("compliance"),
    type: "compliance",
    props: { content: DEFAULT_DISCLOSURE, style: { fontSize: 9, color: "#94a3b8", textAlign: "center" } },
  });

  if (formType === "landing") {
    blocks.push({
      id: blockId("img"),
      type: "image-column",
      props: { imageHue: null },
    });
  }

  return {
    version: 1,
    formType,
    imageHue: null,
    blocks,
    successHeadline: DEFAULT_SUCCESS_HEADLINE,
    successMessage: DEFAULT_SUCCESS_MESSAGE,
    contactMode: "create",
  };
}

const TEMPLATE_HUES: Record<string, string | null> = {
  t0: null,
  t1: "#3f5b46",
  t2: "#c45c26",
  t3: "#4a5568",
  t4: "#5b21b6",
  t5: "#7f1d1d",
  t6: "#d6cfc4",
  e1: null,
  e2: null,
  e3: null,
  e4: null,
};

/** Apply a template id to produce a full layout. */
export function layoutFromTemplate(templateId: string, base?: FormLayout): FormLayout {
  const formType = templateId.startsWith("e") ? "embed" : "landing";
  const hue = TEMPLATE_HUES[templateId] ?? null;

  if (templateId === "t0") {
    return {
      version: 1,
      formType,
      imageHue: null,
      blocks: [
        { id: blockId("header"), type: "header", props: { content: "Your Headline", style: { textAlign: "center" } } },
        { id: blockId("phone"), type: "field", props: { fieldKey: "phone", placeholder: "Mobile Number", required: true } },
        { id: blockId("btn"), type: "button", props: { content: "Submit", style: { backgroundColor: "#4f46e5", color: "#fff" } } },
        { id: blockId("compliance"), type: "compliance", props: { content: DEFAULT_DISCLOSURE } },
        ...(formType === "landing"
          ? [{ id: blockId("img"), type: "image-column" as const, props: { imageHue: null } }]
          : []),
      ],
      successHeadline: DEFAULT_SUCCESS_HEADLINE,
      successMessage: DEFAULT_SUCCESS_MESSAGE,
      contactMode: "create",
    };
  }

  const layout = defaultLayoutFromConfig(
    {
      headline: base ? deriveConfigFromLayout(base).headline : "Want 20% off?",
      subheadline: base ? deriveConfigFromLayout(base).subheadline : undefined,
      buttonLabel: base ? deriveConfigFromLayout(base).buttonLabel : "Join Now",
      fields: ["firstName", "lastName", "phone", "email"],
    },
    formType,
  );

  if (hue) {
    layout.imageHue = hue;
    layout.blocks = layout.blocks.map((b) =>
      b.type === "image-column" ? { ...b, props: { ...b.props, imageHue: hue } } : b,
    );
  }

  if (formType === "embed") {
    layout.blocks = layout.blocks.map((b) => {
      if (b.type === "button") {
        return {
          ...b,
          props: {
            ...b.props,
            style: { ...b.props?.style, backgroundColor: "#f8fafc", color: "#0f172a" },
          },
        };
      }
      return b;
    });
  }

  return layout;
}

export function parseFormLayout(raw: unknown): FormLayout | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as FormLayout;
  if (obj.version !== 1 || !Array.isArray(obj.blocks)) return null;
  return {
    version: 1,
    formType: obj.formType === "embed" ? "embed" : "landing",
    imageHue: obj.imageHue ?? null,
    description: obj.description,
    urlPath: obj.urlPath,
    successHeadline: obj.successHeadline,
    successMessage: obj.successMessage,
    contactMode: obj.contactMode === "update" ? "update" : "create",
    customCss: obj.customCss,
    customJs: obj.customJs,
    blocks: obj.blocks.filter((b) => b && typeof b.id === "string" && typeof b.type === "string"),
  };
}

/** Extract flat OptInFormConfig fields from a layout document. */
export function deriveConfigFromLayout(layout: FormLayout): Partial<OptInFormConfig> {
  const fields: FormFieldKey[] = [];
  let headline: string | undefined;
  let subheadline: string | undefined;
  let buttonLabel: string | undefined;

  for (const block of layout.blocks) {
    if (block.type === "header") headline = block.props?.content;
    if (block.type === "text") subheadline = block.props?.content;
    if (block.type === "button") buttonLabel = block.props?.content;
    if (block.type === "compliance") {
      // compliance content synced separately if needed
    }
    if (block.type === "field" && block.props?.fieldKey && !block.props.hidden) {
      if (!fields.includes(block.props.fieldKey)) fields.push(block.props.fieldKey);
    }
    if (block.type === "field-row" && block.props?.fieldKeys) {
      for (const k of block.props.fieldKeys) {
        if (!fields.includes(k)) fields.push(k);
      }
    }
  }

  if (!fields.includes("phone")) fields.unshift("phone");

  return { fields, headline, subheadline, buttonLabel };
}

export function updateBlockInLayout(
  layout: FormLayout,
  blockId: string,
  patch: Partial<NonNullable<FormBlock["props"]>>,
): FormLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === blockId
        ? {
            ...b,
            props: {
              ...b.props,
              ...patch,
              style: patch.style ? { ...b.props?.style, ...patch.style } : b.props?.style,
            },
          }
        : b,
    ),
  };
}

export function updateBlockStyle(
  layout: FormLayout,
  blockId: string,
  stylePatch: Partial<BlockStyle>,
): FormLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === blockId
        ? { ...b, props: { ...b.props, style: { ...b.props?.style, ...stylePatch } } }
        : b,
    ),
  };
}

export function setBlockHidden(layout: FormLayout, blockId: string, hidden: boolean): FormLayout {
  return updateBlockInLayout(layout, blockId, { hidden });
}

export function removeBlockFromLayout(layout: FormLayout, blockId: string): FormLayout {
  return { ...layout, blocks: layout.blocks.filter((b) => b.id !== blockId) };
}

export function insertBlockAt(layout: FormLayout, index: number, block: FormBlock): FormLayout {
  const blocks = [...layout.blocks];
  const safeIndex = Math.max(0, Math.min(index, blocks.length));
  blocks.splice(safeIndex, 0, block);
  return { ...layout, blocks };
}

export function moveBlockInLayout(layout: FormLayout, blockId: string, newIndex: number): FormLayout {
  const blocks = [...layout.blocks];
  const idx = blocks.findIndex((b) => b.id === blockId);
  if (idx < 0) return layout;
  const [block] = blocks.splice(idx, 1);
  const safeIndex = Math.max(0, Math.min(newIndex, blocks.length));
  blocks.splice(safeIndex, 0, block);
  return { ...layout, blocks };
}

export function createBlockFromPalette(elementId: string): FormBlock | null {
  const id = blockId(elementId);
  switch (elementId) {
    case "header":
      return { id, type: "header", props: { content: "New Header", style: { textAlign: "center", fontSize: 24 } } };
    case "text":
      return { id, type: "text", props: { content: "New text block", style: { textAlign: "center", fontSize: 12 } } };
    case "field":
      return { id, type: "field", props: { fieldKey: "email", placeholder: "Email" } };
    case "dropdown":
      return { id, type: "field", props: { fieldKey: "firstName", placeholder: "Select option" } };
    case "button":
      return { id, type: "button", props: { content: "Click Here", style: { backgroundColor: "#4f46e5", color: "#fff", borderRadius: 6 } } };
    case "link":
      return { id, type: "link", props: { content: "Learn more", style: { color: "#6366f1", textDecoration: "underline" } } };
    case "compliance":
      return { id, type: "compliance", props: { content: DEFAULT_DISCLOSURE, style: { fontSize: 9, color: "#94a3b8" } } };
    case "two-col":
      return { id, type: "field-row", props: { fieldKeys: ["firstName", "lastName"] } };
    case "three-col":
      return { id, type: "field-row", props: { fieldKeys: ["firstName", "lastName", "email"] } };
    case "error":
      return { id, type: "error", props: { content: "Error message", style: { color: "#ef4444", fontSize: 11 } } };
    case "image":
      return { id, type: "image-column", props: { imageHue: null } };
    case "container":
      return { id, type: "text", props: { content: "", style: { padding: 16, backgroundColor: "#f8fafc", borderRadius: 8 } } };
    case "icon":
      return { id, type: "text", props: { content: "★", style: { textAlign: "center", fontSize: 24 } } };
    default:
      return null;
  }
}

export const FORM_DND_PALETTE = "application/x-transovo-form-palette";
export const FORM_DND_BLOCK = "application/x-transovo-form-block";

/** Blocks rendered in the form column (excludes landing image column). */
export function isFormCanvasBlock(block: FormBlock): boolean {
  return block.type !== "image-column";
}

export function formCanvasBlocks(layout: FormLayout): FormBlock[] {
  return layout.blocks.filter(isFormCanvasBlock);
}

function blocksWithCanvasOrder(layout: FormLayout, canvasBlocks: FormBlock[]): FormBlock[] {
  const imageBlocks = layout.blocks.filter((b) => b.type === "image-column");
  return [...canvasBlocks, ...imageBlocks];
}

/** Insert a palette element at a canvas index (0 = top of form column). */
export function insertPaletteElementAt(
  layout: FormLayout,
  elementId: string,
  canvasIndex: number,
): FormLayout {
  const block = createBlockFromPalette(elementId);
  if (!block) return layout;

  if (block.type === "image-column") {
    if (layout.formType !== "landing" || layout.blocks.some((b) => b.type === "image-column")) {
      return layout;
    }
    return { ...layout, blocks: [...layout.blocks, block] };
  }

  const canvasBlocks = formCanvasBlocks(layout);
  const safeIndex = Math.max(0, Math.min(canvasIndex, canvasBlocks.length));
  const next = [...canvasBlocks];
  next.splice(safeIndex, 0, block);
  return { ...layout, blocks: blocksWithCanvasOrder(layout, next) };
}

/** Move an existing canvas block to a new canvas index. */
export function moveFormBlock(layout: FormLayout, blockId: string, canvasIndex: number): FormLayout {
  const canvasBlocks = formCanvasBlocks(layout);
  const fromIdx = canvasBlocks.findIndex((b) => b.id === blockId);
  if (fromIdx < 0) return layout;

  const reordered = [...canvasBlocks];
  const [moved] = reordered.splice(fromIdx, 1);
  const safeIndex = Math.max(0, Math.min(canvasIndex, reordered.length));
  reordered.splice(safeIndex, 0, moved);
  return { ...layout, blocks: blocksWithCanvasOrder(layout, reordered) };
}

export function addPaletteElement(layout: FormLayout, elementId: string): FormLayout {
  const block = createBlockFromPalette(elementId);
  if (!block) return layout;

  if (block.type === "image-column") {
    if (layout.blocks.some((b) => b.type === "image-column")) {
      return layout;
    }
    return { ...layout, blocks: [...layout.blocks, block] };
  }

  const insertBefore = layout.blocks.findIndex((b) => b.type === "button" || b.type === "compliance");
  const index = insertBefore >= 0 ? insertBefore : formCanvasBlocks(layout).length;
  return insertPaletteElementAt(layout, elementId, index);
}

export function syncLayoutContent(
  layout: FormLayout,
  patch: {
    headline?: string;
    subheadline?: string;
    buttonLabel?: string;
    imageHue?: string | null;
    formType?: "landing" | "embed";
  },
): FormLayout {
  const next = { ...layout };
  if (patch.formType) next.formType = patch.formType;
  if (patch.imageHue !== undefined) next.imageHue = patch.imageHue;

  next.blocks = next.blocks.map((b) => {
    if (b.type === "header" && patch.headline !== undefined) {
      return { ...b, props: { ...b.props, content: patch.headline } };
    }
    if (b.type === "text" && patch.subheadline !== undefined) {
      return { ...b, props: { ...b.props, content: patch.subheadline } };
    }
    if (b.type === "button" && patch.buttonLabel !== undefined) {
      return { ...b, props: { ...b.props, content: patch.buttonLabel } };
    }
    if (b.type === "image-column" && patch.imageHue !== undefined) {
      return { ...b, props: { ...b.props, imageHue: patch.imageHue } };
    }
    return b;
  });

  if (patch.formType === "embed") {
    next.blocks = next.blocks.filter((b) => b.type !== "image-column");
  } else if (patch.formType === "landing" && !next.blocks.some((b) => b.type === "image-column")) {
    next.blocks.push({
      id: blockId("img"),
      type: "image-column",
      props: { imageHue: next.imageHue ?? null },
    });
  }

  return next;
}

export function fieldsFromLayout(layout: FormLayout): FormFieldKey[] {
  return deriveConfigFromLayout(layout).fields || ["firstName", "phone"];
}

export function ensureEmailField(layout: FormLayout, include: boolean): FormLayout {
  const hasEmail = layout.blocks.some(
    (b) => b.type === "field" && b.props?.fieldKey === "email",
  );
  if (include && !hasEmail) {
    const btnIdx = layout.blocks.findIndex((b) => b.type === "button");
    const insertAt = btnIdx >= 0 ? btnIdx : layout.blocks.length;
    const blocks = [...layout.blocks];
    blocks.splice(insertAt, 0, {
      id: blockId("email"),
      type: "field",
      props: { fieldKey: "email", placeholder: "Email" },
    });
    return { ...layout, blocks };
  }
  if (!include && hasEmail) {
    return {
      ...layout,
      blocks: layout.blocks.filter(
        (b) => !(b.type === "field" && b.props?.fieldKey === "email"),
      ),
    };
  }
  if (include && hasEmail) {
    return {
      ...layout,
      blocks: layout.blocks.map((b) =>
        b.type === "field" && b.props?.fieldKey === "email"
          ? { ...b, props: { ...b.props, hidden: false } }
          : b,
      ),
    };
  }
  return layout;
}

export function setFieldKeyOnBlock(layout: FormLayout, blockId: string, fieldKey: FormFieldKey): FormLayout {
  const placeholders: Record<FormFieldKey, string> = {
    phone: "Mobile Number",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    dateOfBirth: "Date of birth",
  };
  return updateBlockInLayout(layout, blockId, {
    fieldKey,
    placeholder: placeholders[fieldKey],
    inputMode: fieldKey === "email" ? "email" : fieldKey === "phone" ? "phone" : "standard",
  });
}
