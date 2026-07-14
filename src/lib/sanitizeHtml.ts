import DOMPurify from 'dompurify';

// NOTE: DOMPurify does NOT sanitize CSS values inside a `style` attribute by
// default (verified against 3.4.12: `style="background:url(javascript:...)"`
// passes through untouched even with SAFE_FOR_TEMPLATES). Since this app only
// ever needs `style` for TipTap's TextAlign extension output
// (`text-align: left|center|right|justify`), we allowlist that one property
// explicitly rather than trusting DOMPurify to scrub arbitrary CSS.
const ALLOWED_STYLE_PROPS: Record<string, RegExp> = {
  'text-align': /^(left|right|center|justify|start|end)$/i,
};

function sanitizeStyleAttr(style: string): string {
  return style
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .reduce<string[]>((safeDeclarations, declaration) => {
      const separatorIndex = declaration.indexOf(':');
      if (separatorIndex === -1) return safeDeclarations;

      const prop = declaration.slice(0, separatorIndex).trim().toLowerCase();
      const value = declaration.slice(separatorIndex + 1).trim();
      const allowedValuePattern = ALLOWED_STYLE_PROPS[prop];

      if (allowedValuePattern && allowedValuePattern.test(value)) {
        safeDeclarations.push(`${prop}: ${value}`);
      }
      return safeDeclarations;
    }, [])
    .join('; ');
}

// Registered once at module load: both hooks are idempotent (same input
// always produces the same output), so it's safe to run them on every
// sanitize() call rather than re-registering per-invocation.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer');
  }

  if (node.hasAttribute('style')) {
    const safeStyle = sanitizeStyleAttr(node.getAttribute('style') ?? '');
    if (safeStyle) {
      node.setAttribute('style', safeStyle);
    } else {
      node.removeAttribute('style');
    }
  }
});

/** Strips scripts, event handlers, and dangerous URLs from user-authored HTML
 *  (lesson content, imported documents) before it's rendered via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'style'],
  });
}
