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

  it('forces rel="noopener noreferrer" onto target="_blank" links', () => {
    const dirty = '<a href="https://evil.example" target="_blank">click</a>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('preserves text-align style on a paragraph', () => {
    const safe = '<p style="text-align: center">Centered</p>';
    const clean = sanitizeHtml(safe);
    expect(clean).toContain('text-align');
    expect(clean).toContain('Centered');
  });

  it('neutralizes dangerous CSS values inside style attributes', () => {
    const dirty = '<p style="background:url(javascript:alert(1))">x</p>';
    expect(() => sanitizeHtml(dirty)).not.toThrow();
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain('javascript:');
  });

  it('preserves basic table structure', () => {
    const safe = '<table><tbody><tr><td>cell</td></tr></tbody></table>';
    const clean = sanitizeHtml(safe);
    expect(clean).toContain('<table>');
    expect(clean).toContain('<tr>');
    expect(clean).toContain('<td>cell</td>');
  });
});
