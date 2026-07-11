// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '../sanitizeHtml';

describe('sanitizeHtml', () => {
  it('strips <script> tags entirely', () => {
    const dirty = '<p>Hello</p><script>alert(1)</script>';
    expect(sanitizeHtml(dirty)).toBe('<p>Hello</p>');
  });

  it('strips inline event handlers like onerror', () => {
    const dirty = '<img src="x" onerror="alert(1)">';
    expect(sanitizeHtml(dirty)).not.toContain('onerror');
  });

  it('strips javascript: URLs from links', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeHtml(dirty)).not.toContain('javascript:');
  });

  it('preserves safe formatting tags', () => {
    const safe = '<p><strong>Bold</strong> and <em>italic</em></p>';
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('preserves images with allowed attributes', () => {
    const safe = '<img src="https://example.com/a.png" alt="desc">';
    expect(sanitizeHtml(safe)).toBe(safe);
  });
});
