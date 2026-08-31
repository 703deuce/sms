import type { FormFieldKey, OptInFormConfig } from "@/lib/forms/types";
import { DEFAULT_DISCLOSURE } from "@/lib/forms/types";

export type FormBlockType =
  | "header"
  | "text"
  | "field"
  | "field-row"
  | "button"
  | "compliance"
  | "image-column";

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
      props: { content: config.headline || "Want 20% off?" },
    },
    {
      id: blockId("text"),
      type: "text",
      props: {
        content:
          config.subheadline ||
          "Join our VIP text list and receive a code for your next purchase.",
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
    props: { fieldKey: "phone", placeholder: "Mobile Number" },
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
    props: { content: config.buttonLabel || "Join Now" },
  });

  blocks.push({
    id: blockId("compliance"),
    type: "compliance",
    props: { content: DEFAULT_DISCLOSURE },
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
  patch: Partial<FormBlock["props"]>,
): FormLayout {
  return {
    ...layout,
    blocks: layout.blocks.map((b) =>
      b.id === blockId ? { ...b, props: { ...b.props, ...patch } } : b,
    ),
  };
}

export function setBlockHidden(layout: FormLayout, blockId: string, hidden: boolean): FormLayout {
  return updateBlockInLayout(layout, blockId, { hidden });
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
  let next = { ...layout };
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
      blocks: layout.blocks.map((b) =>
        b.type === "field" && b.props?.fieldKey === "email"
          ? { ...b, props: { ...b.props, hidden: true } }
          : b,
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
