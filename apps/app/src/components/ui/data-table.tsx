import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MaterialSymbol } from "@/components/MaterialSymbol";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Rendered above the table, left side (e.g. active filter chips). */
  toolbarLeft?: React.ReactNode;
  /** REQ-TBL-002 / REQ-TAB-*: lets the user hide noisy columns per view. */
  columnVisibilityToggle?: boolean;
  emptyMessage?: string;
}

/** Thin TanStack Table wrapper over the shadcn Table primitive — REQ-TBL-004
 *  (multi-column sort, shift-click a header to add a sort key) and
 *  REQ-TBL-002 (column show/hide). Deliberately headless beyond that: pinning,
 *  row-selection/bulk-actions, and pagination are added per-table when a
 *  concrete table needs them, not speculatively here. */
export function DataTable<TData, TValue>({
  columns, data, toolbarLeft, columnVisibilityToggle, emptyMessage = "Aucun résultat",
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: true,
    isMultiSortEvent: () => true,
  });

  return (
    <div className="flex flex-col gap-3">
      {(toolbarLeft || columnVisibilityToggle) && (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">{toolbarLeft}</div>
          {columnVisibilityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <MaterialSymbol name="visibility_off" size={18} /> Colonnes
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {table.getAllColumns().filter((c) => c.getCanHide()).map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(v) => column.toggleVisibility(!!v)}
                  >
                    {typeof column.columnDef.header === "string" ? column.columnDef.header : column.id}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      <div className="ap-density-table rounded-md border" style={{ borderColor: "var(--ap-line)" }}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortIndex = header.column.getSortIndex();
                  const sortDir = header.column.getIsSorted();
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className="flex items-center gap-1.5 select-none"
                          onClick={header.column.getToggleSortingHandler()}
                          title="Trier — Maj+clic pour trier sur plusieurs colonnes"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortDir === "asc" ? <MaterialSymbol name="arrow_upward" size={17} /> : sortDir === "desc" ? <MaterialSymbol name="arrow_downward" size={17} /> : <MaterialSymbol name="swap_vert" size={17} className="opacity-40" />}
                          {sortDir && sorting.length > 1 && (
                            <span className="text-[10px] font-bold opacity-60">{sortIndex + 1}</span>
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center" style={{ color: "var(--ap-muted)" }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs font-semibold" style={{ color: "var(--ap-muted)" }}>
        {table.getRowModel().rows.length} résultat{table.getRowModel().rows.length !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
