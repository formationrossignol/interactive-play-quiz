import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { PageSkeleton } from '../PageSkeleton';
import { CardSkeleton } from '../CardSkeleton';
import { ListSkeleton } from '../ListSkeleton';
import { TableSkeleton } from '../TableSkeleton';
import { ProfileSkeleton } from '../ProfileSkeleton';

expect.extend(toHaveNoViolations);

// CLAUDE.md mandates these templates for every loading state in the app —
// axe coverage here protects every page that reaches for one, not just the
// templates themselves.
describe('skeleton templates accessibility', () => {
  it('PageSkeleton has no axe violations', async () => {
    const { container } = render(<PageSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('CardSkeleton has no axe violations', async () => {
    const { container } = render(<CardSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ListSkeleton has no axe violations', async () => {
    const { container } = render(<ListSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('TableSkeleton has no axe violations', async () => {
    const { container } = render(<TableSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('ProfileSkeleton has no axe violations', async () => {
    const { container } = render(<ProfileSkeleton />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
