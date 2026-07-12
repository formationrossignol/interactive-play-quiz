const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB

/** Rejects import files above a size cap before they reach xlsx/js-yaml parsing,
 *  bounding the blast radius of known prototype-pollution/ReDoS issues in those parsers. */
export function assertSafeImportFile(file: File): void {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`Fichier trop volumineux (max ${MAX_IMPORT_FILE_BYTES / 1024 / 1024} Mo).`);
  }
}
