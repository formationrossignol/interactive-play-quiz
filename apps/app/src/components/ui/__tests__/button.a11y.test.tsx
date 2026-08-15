import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '../button';

expect.extend(toHaveNoViolations);

describe('Button accessibility', () => {
  it('has no axe violations at rest', async () => {
    const { container } = render(<Button>Enregistrer</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations while loading (shimmer label, never a bare spinner)', async () => {
    const { container } = render(<Button loading>Enregistrer</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations when disabled', async () => {
    const { container } = render(<Button disabled>Enregistrer</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
