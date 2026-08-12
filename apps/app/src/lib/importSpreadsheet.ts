import { assertSafeImportFile } from "@/lib/fileValidation";

/** Reads the first sheet of a CSV or XLSX file as raw string rows (row 0 =
 *  headers). Shared by every "upload a spreadsheet, preview, map columns"
 *  import flow in the LMS (gradebook notes, session roster, …) so the
 *  parsing/size-guard logic exists exactly once. */
export async function parseSpreadsheetRows(file: File): Promise<string[][]> {
  assertSafeImportFile(file);
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" });
  return rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell !== ""));
}
