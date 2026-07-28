const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a quiz question bank (a few thousand rows); not a fix for xlsx's structural CVEs, just a generic size sanity check.

/** Rejects absurdly large import files before they reach xlsx/js-yaml parsing.
 *  NOTE: this is a coarse DoS/sanity guard, not a mitigation for xlsx's known
 *  prototype-pollution/ReDoS CVEs (both are triggered by payload structure, not
 *  size — a small malicious file is just as exploitable). Those remain open;
 *  see AUDIT_CODE.md H-3. Real fix requires replacing/sandboxing the xlsx parser.
 *
 *  Accepted-risk dependencies as of the 2026-07-28 commercial-readiness audit
 *  (memory: commercial-readiness-audit-2026-07-28) — `npm audit` flags these
 *  with no non-breaking fix available; re-check on the next dependency pass:
 *  - xlsx (proto pollution + ReDoS, both high): SheetJS stopped publishing
 *    patched releases to the npm registry; no newer npm version exists.
 *  - sharp (libvips CVEs, high): transitive via next, only fixable by a next
 *    major-version bump.
 *  - react-router-dom (open redirect → XSS, moderate, CVSS 6.9): the
 *    installed 6.30.4 is the last version ever published on the 6.x line and
 *    is itself inside the vulnerable range (>=6.30.2 <=6.30.4) — `npm audit`
 *    reports `fixAvailable: true` but there is no non-breaking upgrade; the
 *    real fix is react-router 7.18.0+, a major-version migration. */
export function assertSafeImportFile(file: File, maxBytes: number = MAX_IMPORT_FILE_BYTES): void {
  if (file.size > maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(maxBytes / 1024 / 1024)} Mo).`);
  }
}
