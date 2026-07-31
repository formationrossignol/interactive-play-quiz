import type { OrgRole } from './orgRepo';

export const roleOptions: { value: OrgRole; label: string }[] = [
  { value: 'learner', label: 'Apprenant' },
  { value: 'trainer', label: 'Formateur' },
  { value: 'pedago', label: 'Responsable pédagogique' },
  { value: 'registrar', label: 'Gestionnaire de scolarité' },
  { value: 'admin', label: 'Administrateur' },
];

export const roleLabel = (role: OrgRole): string => roleOptions.find((r) => r.value === role)?.label ?? role;
