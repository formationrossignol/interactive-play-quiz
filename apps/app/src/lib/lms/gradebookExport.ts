import type { GradeItem } from "./gradebook";
import type { GradeCell } from "./gradebookCalculations";

export type GradebookExportFormat = "CSV" | "Excel" | "PDF";

export interface GradebookExportRow {
  learnerName: string;
  cells: Record<string, GradeCell>;
  categoryTotals: Record<string, number | null>;
  overallPercentage: number | null;
}

export interface GradebookExportPayload {
  sessionLabel: string;
  items: GradeItem[];
  categories: string[];
  rows: GradebookExportRow[];
}

const STATUS_LABEL: Record<GradeCell["status"], string> = {
  graded: "",
  excused: "Dispensé",
  missing: "Non remis",
  not_graded: "Non noté",
};

function cellDisplay(cell: GradeCell | undefined, maxPoints: number): string {
  if (!cell || cell.status !== "graded" || cell.points === null) return STATUS_LABEL[cell?.status ?? "not_graded"];
  return `${cell.points}/${maxPoints}`;
}

function headersOf(payload: GradebookExportPayload): string[] {
  return [
    "Apprenant",
    ...payload.items.map((item) => `${item.title} (/${item.max_points})`),
    ...payload.categories.map((category) => `${category} (%)`),
    "Total (%)",
  ];
}

function rowsOf(payload: GradebookExportPayload): Array<Array<string | number>> {
  return payload.rows.map((row) => [
    row.learnerName,
    ...payload.items.map((item) => cellDisplay(row.cells[item.id], item.max_points)),
    ...payload.categories.map((category) => {
      const pct = row.categoryTotals[category];
      return pct === null || pct === undefined ? "—" : pct.toFixed(1);
    }),
    row.overallPercentage === null ? "—" : row.overallPercentage.toFixed(1),
  ]);
}

/** GBK-006 acceptance: "exports neutralize spreadsheet formulas" — a cell
 *  text starting with = + - @ is a live formula in Excel/LibreOffice unless
 *  defanged with a leading apostrophe. Mirrors calculations.ts's csvCell. */
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

const safeFilename = (sessionLabel: string) => {
  const slug = sessionLabel
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `gradebook_${slug || "session"}`;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Caller passes only the currently-filtered rows/items — the export must
 *  reflect exactly what's on screen (GBK-006: "respect active filters"). */
export async function exportGradebook(format: GradebookExportFormat, payload: GradebookExportPayload): Promise<void> {
  const headers = headersOf(payload);
  const rows = rowsOf(payload);
  const filename = safeFilename(payload.sessionLabel);

  if (format === "CSV") {
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
    downloadBlob(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    return;
  }

  if (format === "Excel") {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    worksheet["!cols"] = headers.map((_, index) => ({ wch: index === 0 ? 28 : 16 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gradebook");
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    return;
  }

  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(`Carnet de notes — ${payload.sessionLabel}`, 14, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(100);
  pdf.text(`Exporté le ${new Date().toLocaleString("fr")}`, 14, 21);
  autoTable(pdf, {
    startY: 27,
    head: [headers],
    body: rows.map((row) => row.map(String)),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [76, 57, 168], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [247, 244, 238] },
  });
  pdf.save(`${filename}.pdf`);
}
