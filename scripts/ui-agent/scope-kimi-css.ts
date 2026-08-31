/**
 * Scope Kimi reference.css selectors under a route wrapper (e.g. .kimi-campaigns)
 * so global classes like .btn-primary / .input do not collide across routes or with
 * Transovo theme utilities (.text-foreground, .bg-background, etc.).
 */

function findClosingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

function scopeSelector(selector: string, scope: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return trimmed;
  if (trimmed === ":root" || trimmed === "body" || trimmed === "html") return scope;
  if (trimmed === scope || trimmed.startsWith(`${scope} `) || trimmed.startsWith(`${scope}:`)) {
    return trimmed;
  }
  return `${scope} ${trimmed}`;
}

function scopeRuleBlock(selectors: string, body: string, scope: string): string {
  const scopedSelectors = selectors
    .split(",")
    .map((part) => scopeSelector(part, scope))
    .join(", ");
  return `${scopedSelectors}{${body}}`;
}

export function scopeKimiCss(css: string, scopeClass: string): string {
  const scope = scopeClass.startsWith(".") ? scopeClass : `.${scopeClass}`;
  let i = 0;
  let out = "";

  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i]!)) {
      out += css[i];
      i++;
    }
    if (i >= css.length) break;

    if (css[i] === "@") {
      const semi = css.indexOf(";", i);
      const open = css.indexOf("{", i);
      if (open === -1 || (semi !== -1 && semi < open)) {
        out += css.slice(i, semi + 1);
        i = semi + 1;
        continue;
      }

      const prelude = css.slice(i, open).trim();
      const close = findClosingBrace(css, open);
      const inner = css.slice(open + 1, close);

      if (prelude.startsWith("@keyframes") || prelude.startsWith("@font-face")) {
        out += css.slice(i, close + 1);
      } else if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
        out += `${prelude}{${scopeKimiCss(inner, scopeClass)}}`;
      } else {
        out += css.slice(i, close + 1);
      }

      i = close + 1;
      continue;
    }

    const open = css.indexOf("{", i);
    if (open === -1) {
      out += css.slice(i);
      break;
    }

    const selectors = css.slice(i, open).trim();
    const close = findClosingBrace(css, open);
    const body = css.slice(open + 1, close);
    out += scopeRuleBlock(selectors, body, scope);
    i = close + 1;
  }

  return out;
}
