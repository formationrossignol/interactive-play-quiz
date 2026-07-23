import DOMPurify from "isomorphic-dompurify";

// Mirrors apps/app/src/lib/sanitizeHtml.ts. DOMPurify does NOT sanitize CSS
// values inside a `style` attribute by default, so the one property this app
// ever needs (TipTap's TextAlign output) is allowlisted explicitly rather
// than trusting DOMPurify to scrub arbitrary CSS.
const ALLOWED_STYLE_PROPS: Record<string, RegExp> = {
  "text-align": /^(left|right|center|justify|start|end)$/i,
};

function sanitizeStyleAttr(style: string): string {
  return style
    .split(";")
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<string[]>((safeDeclarations, declaration) => {
      const separatorIndex = declaration.indexOf(":");
      if (separatorIndex === -1) return safeDeclarations;

      const prop = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();
      const allowedValuePattern = ALLOWED_STYLE_PROPS[prop];

      if (allowedValuePattern && allowedValuePattern.test(value)) {
        safeDeclarations.push(`${prop}: ${value}`);
      }
      return safeDeclarations;
    }, [])
    .join("; ");
}

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.getAttribute("target")) {
    node.setAttribute("rel", "noopener noreferrer");
  }

  if (node.hasAttribute("style")) {
    const safeStyle = sanitizeStyleAttr(node.getAttribute("style") ?? "");
    if (safeStyle) {
      node.setAttribute("style", safeStyle);
    } else {
      node.removeAttribute("style");
    }
  }
});

/** Strips scripts, event handlers, and dangerous URLs from admin-authored HTML
 *  before it's rendered via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "a", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "blockquote", "code", "pre", "img",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "style"],
  });
}
