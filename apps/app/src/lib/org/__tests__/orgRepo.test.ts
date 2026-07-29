import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

import { slugify } from '../orgRepo';

describe('slugify', () => {
  it('lowercases and hyphenates spaces', () => {
    expect(slugify('Lycée Victor Hugo')).toBe('lycee-victor-hugo');
  });

  it('strips accents', () => {
    expect(slugify('Établissement Général')).toBe('etablissement-general');
  });

  it('collapses repeated separators', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('-Test-')).toBe('test');
  });

  it('drops characters outside [a-z0-9-]', () => {
    expect(slugify("L'École & Cie !")).toBe('l-ecole-cie');
  });
});
