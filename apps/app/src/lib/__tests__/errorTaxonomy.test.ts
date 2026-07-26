import { describe, it, expect, vi } from 'vitest';
import { classifyError, showError, ValidationError } from '../errorTaxonomy';
import { PlanLimitError } from '../plans';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
import { toast } from 'sonner';

describe('classifyError', () => {
  it('classifies PlanLimitError as business, with an upgrade action', () => {
    const result = classifyError(new PlanLimitError('quiz', 5, 'starter'));
    expect(result.kind).toBe('business');
    expect(result.action?.label).toBe('Passer Pro');
  });

  it('classifies ValidationError as validation, no action', () => {
    const result = classifyError(new ValidationError('Titre requis'));
    expect(result).toEqual({ kind: 'validation', message: 'Titre requis' });
  });

  it('classifies a plain Error as system', () => {
    const result = classifyError(new Error('boom'));
    expect(result.kind).toBe('system');
    expect(result.message).not.toContain('boom');
    expect(result.action?.label).toBe('Réessayer');
  });

  it('classifies a non-Error throw as system with a generic message', () => {
    const result = classifyError('boom');
    expect(result.kind).toBe('system');
    expect(result.message).toContain('Réessayez');
  });

  it('turns technical permission failures into an actionable message', () => {
    const result = classifyError({ status: 403, message: 'Forbidden' });
    expect(result.kind).toBe('business');
    expect(result.message).toBe("Vous n’avez pas les droits pour modifier cette ressource.");
    expect(result.action?.label).toBe("Demander l’accès");
  });

  it('recognises Supabase row-level security failures', () => {
    const result = classifyError({ code: '42501', message: 'permission denied for table content' });
    expect(result.action?.label).toBe("Demander l’accès");
  });

  it.each([
    [{ status: 401 }, 'Se reconnecter'],
    [{ status: 404 }, 'Retour aux contenus'],
    [{ status: 409 }, 'Actualiser'],
    [{ status: 429 }, 'Réessayer'],
    [{ status: 504 }, 'Réessayer'],
    [{ message: 'Failed to fetch' }, 'Réessayer'],
  ])('maps a common failure to a useful action', (error, actionLabel) => {
    expect(classifyError(error).action?.label).toBe(actionLabel);
  });
});

describe('showError', () => {
  it('logs system errors to the console, not validation/business ones', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    showError(new ValidationError('bad input'));
    expect(errSpy).not.toHaveBeenCalled();
    showError(new Error('boom'), 'MyComponent');
    expect(errSpy).toHaveBeenCalledWith('[MyComponent]', expect.any(Error));
    errSpy.mockRestore();
  });

  it('always toasts, with an action only when the error carries one', () => {
    vi.mocked(toast.error).mockClear();
    showError(new Error('boom'));
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('Réessayez'),
      expect.objectContaining({ action: expect.objectContaining({ label: 'Réessayer' }) }),
    );

    showError(new PlanLimitError('quiz', 5, 'starter'));
    expect(toast.error).toHaveBeenLastCalledWith(
      expect.stringContaining('Limite du plan'),
      expect.objectContaining({ action: expect.objectContaining({ label: 'Passer Pro' }) }),
    );
  });

  it('uses fallbackMessage for system errors but never for business/validation ones', () => {
    vi.mocked(toast.error).mockClear();
    showError(new Error('ECONNRESET'), undefined, "Erreur lors de l'enregistrement");
    expect(toast.error).toHaveBeenCalledWith(
      "Erreur lors de l'enregistrement",
      expect.objectContaining({ action: expect.objectContaining({ label: 'Réessayer' }) }),
    );

    showError(new PlanLimitError('quiz', 5, 'starter'), undefined, 'ignored fallback');
    expect(toast.error).toHaveBeenLastCalledWith(
      expect.stringContaining('Limite du plan'),
      expect.anything(),
    );
  });
});
