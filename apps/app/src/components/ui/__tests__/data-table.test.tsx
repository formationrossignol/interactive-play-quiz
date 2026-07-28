import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../data-table';

expect.extend(toHaveNoViolations);

interface Row {
  id: string;
  name: string;
}

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Nom' },
];

describe('DataTable accessibility', () => {
  it('has no axe violations with rows', async () => {
    const { container } = render(
      <DataTable columns={columns} data={[{ id: '1', name: 'Alice' }, { id: '2', name: 'Bob' }]} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations in the empty state', async () => {
    const { container } = render(<DataTable columns={columns} data={[]} emptyMessage="Aucune ligne" />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('has no axe violations with the column-visibility toolbar', async () => {
    const { container } = render(
      <DataTable columns={columns} data={[{ id: '1', name: 'Alice' }]} columnVisibilityToggle />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
