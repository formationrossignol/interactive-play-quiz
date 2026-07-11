import DOMPurify from 'dompurify';

/** Strips scripts, event handlers, and dangerous URLs from user-authored HTML
 *  (lesson content, imported documents) before it's rendered via dangerouslySetInnerHTML. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel'],
  });
}
