"use client";

import { useEffect, useLayoutEffect } from "react";
import {
  OVERVIEW_NEUTRAL_RUNTIME_CSS,
  OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID,
  OVERVIEW_PRODUCT_THEME_INLINE_VARS,
} from "./appointments-overview-neutral-runtime";
import "./appointments-overview-pilot.css";
import "./appointments-overview-neutral-r2.css";
import "./appointments-overview-soft-cool-slate.css";

/** Not `appt-overview-pilot-active` — stale bundles map that class to teal `--primary`. */
const PILOT_HTML_CLASS = "appt-overview-slate-204";

function applyProductThemeInlineVars() {
  const product = document.querySelector<HTMLElement>(".product-theme");
  if (!product) return;
  for (const [key, value] of Object.entries(OVERVIEW_PRODUCT_THEME_INLINE_VARS)) {
    product.style.setProperty(key, value, "important");
  }
}

export function mountOverviewPilotRuntimeStyles() {
  let el = document.getElementById(OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID;
    el.setAttribute("data-overview-neutral-runtime", "soft-cool-slate-204");
    document.head.appendChild(el);
  }
  el.textContent = OVERVIEW_NEUTRAL_RUNTIME_CSS;
  applyProductThemeInlineVars();
}

export function unmountOverviewPilotRuntimeStyles() {
  document.getElementById(OVERVIEW_NEUTRAL_RUNTIME_STYLE_ID)?.remove();
  const product = document.querySelector<HTMLElement>(".product-theme");
  if (product) {
    for (const key of Object.keys(OVERVIEW_PRODUCT_THEME_INLINE_VARS)) {
      product.style.removeProperty(key);
    }
  }
}

/** Overview only — light unified shell + neutral charcoal actions + Geist. */
export function AppointmentsOverviewPilotChrome({
  children,
  fontVariableClass,
}: Readonly<{ children: React.ReactNode; fontVariableClass: string }>) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.add(PILOT_HTML_CLASS, fontVariableClass);
    mountOverviewPilotRuntimeStyles();
  }, [fontVariableClass]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(PILOT_HTML_CLASS, fontVariableClass);
    mountOverviewPilotRuntimeStyles();

    const product = document.querySelector(".product-theme");
    const observer = new MutationObserver(() => {
      applyProductThemeInlineVars();
    });
    if (product) {
      observer.observe(product, { attributes: true, attributeFilter: ["style"] });
    }

    return () => {
      observer.disconnect();
      root.classList.remove(PILOT_HTML_CLASS, fontVariableClass);
      unmountOverviewPilotRuntimeStyles();
    };
  }, [fontVariableClass]);

  return children;
}
