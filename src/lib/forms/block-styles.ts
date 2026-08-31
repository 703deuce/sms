import type { CSSProperties } from "react";

/** Per-block visual and field settings persisted in FormLayout. */
export type BlockStyle = {
  color?: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  textDecoration?: string;
  textAlign?: "left" | "center" | "right";
  padding?: number;
  margin?: number;
  borderWidth?: number;
  borderColor?: string;
  borderRadius?: number;
  boxShadow?: string;
  opacity?: number;
  hiddenOnMobile?: boolean;
  hiddenOnDesktop?: boolean;
  customCss?: string;
  backgroundImageSize?: "cover" | "contain";
  backgroundImagePositionX?: number;
  backgroundImagePositionY?: number;
};

export const DEFAULT_BLOCK_STYLE: BlockStyle = {
  color: undefined,
  backgroundColor: undefined,
  fontFamily: undefined,
  fontSize: undefined,
  fontWeight: undefined,
  fontStyle: undefined,
  textDecoration: undefined,
  textAlign: "center",
  padding: undefined,
  margin: undefined,
  borderWidth: undefined,
  borderColor: undefined,
  borderRadius: undefined,
  boxShadow: undefined,
  opacity: 100,
  hiddenOnMobile: false,
  hiddenOnDesktop: false,
};

/** Convert block style props to inline React CSSProperties. */
export function blockStyleToCss(
  style: BlockStyle | undefined,
  device?: "desktop" | "tablet" | "mobile",
): CSSProperties {
  if (!style) return {};
  if (device === "mobile" && style.hiddenOnMobile) return { display: "none" };
  if (device === "desktop" && style.hiddenOnDesktop) return { display: "none" };

  const css: CSSProperties = {};
  if (style.color) css.color = style.color;
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = `${style.fontSize}px`;
  if (style.fontWeight) css.fontWeight = style.fontWeight;
  if (style.fontStyle) css.fontStyle = style.fontStyle;
  if (style.textDecoration) css.textDecoration = style.textDecoration;
  if (style.textAlign) css.textAlign = style.textAlign;
  if (style.padding !== undefined) css.padding = `${style.padding}px`;
  if (style.margin !== undefined) css.margin = `${style.margin}px`;
  if (style.borderWidth !== undefined) {
    css.borderWidth = `${style.borderWidth}px`;
    css.borderStyle = "solid";
    css.borderColor = style.borderColor || "#e2e8f0";
  }
  if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`;
  if (style.boxShadow) css.boxShadow = style.boxShadow;
  if (style.opacity !== undefined && style.opacity !== 100) css.opacity = style.opacity / 100;
  return css;
}
