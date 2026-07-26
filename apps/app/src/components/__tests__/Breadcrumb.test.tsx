import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Breadcrumb } from '../Breadcrumb';

expect.extend(toHaveNoViolations);

describe('Breadcrumb accessibility', () => {
  it('has no axe violations at the root', async () => {
    const { container } = render(<Breadcrumb onHome={() => {}} items={[{ label: 'Racine' }]} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations several levels deep', async () => {
    const { container } = render(
      <Breadcrumb
        onHome={() => {}}
        items={[
          { label: 'Mes cours', onClick: () => {} },
          { label: 'Dossier A', onClick: () => {} },
          { label: 'Cours actuel' },
        ]}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
