import { describe, it, expect } from 'vitest';
import { roleOptions, roleLabel } from '../roleLabels';

describe('roleLabel', () => {
  it('maps every OrgRole to its French label', () => {
    expect(roleLabel('learner')).toBe('Apprenant');
    expect(roleLabel('trainer')).toBe('Formateur');
    expect(roleLabel('pedago')).toBe('Responsable pédagogique');
    expect(roleLabel('registrar')).toBe('Gestionnaire de scolarité');
    expect(roleLabel('admin')).toBe('Administrateur');
  });

  it('falls back to the raw role string for an unknown value', () => {
    expect(roleLabel('unknown' as never)).toBe('unknown');
  });
});

describe('roleOptions', () => {
  it('has exactly the 5 OrgRole values, in a stable order', () => {
    expect(roleOptions.map((r) => r.value)).toEqual(['learner', 'trainer', 'pedago', 'registrar', 'admin']);
  });
});
