const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a quiz question bank (a few thousand rows); not a fix for xlsx's structural CVEs, just a generic size sanity check.

/** Rejects absurdly large import files before they reach xlsx/js-yaml parsing.
 *  NOTE: this is a coarse DoS/sanity guard, not a mitigation for xlsx's known
 *  prototype-pollution/ReDoS CVEs (both are triggered by payload structure, not
 *  size — a small malicious file is just as exploitable). Those remain open;
 *  see AUDIT_CODE.md H-3. Real fix requires replacing/sandboxing the xlsx parser. */
export function assertSafeImportFile(file: File, maxBytes: number = MAX_IMPORT_FILE_BYTES): void {
  if (file.size > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo).`);
  }
}
