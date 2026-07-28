import JSZip from 'jszip';
import { supabase } from './supabase';
import { parseScormManifest, ScormManifestError } from './scormManifest';
import { genId } from './courseStorage';

const MAX_PACKAGE_BYTES = 100 * 1024 * 1024; // 100MB, generous for a single-SCO package

export interface ScormImportResult {
  packageId: string;
  version: '1.2' | '2004';
  launchPath: string;
  title: string;
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'text/html';
  if (lower.endsWith('.js')) return 'application/javascript';
  if (lower.endsWith('.css')) return 'text/css';
  if (lower.endsWith('.xml')) return 'application/xml';
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

// Defensive, non-exhaustive check: rejects the obviously-dangerous shapes
// (absolute URLs, scheme-like prefixes, absolute paths, `../` traversal
// segments, UNC-style paths, percent-encoded traversal) rather than
// attempting general-purpose path sanitization. Both callers below only
// need "is this clearly trying to escape its own package/user prefix", not
// a full RFC-3986 URL parse.
function isUnsafeRelativePath(path: string): boolean {
  if (!path) return true;

  // Single-form checks: independent of decoding, and deliberately ordering-
  // agnostic (each check normalizes whatever it needs internally) so a UNC
  // path is caught regardless of what other checks run first.
  const looksUnsafeRaw = (candidate: string): boolean => {
    // Absolute URLs / protocol-relative / scheme-like (e.g. "http://",
    // "https://", "//host/...", "javascript:", "data:").
    if (/^[a-z][a-z0-9+.-]*:/i.test(candidate)) return true;
    // UNC-style path ("\\server\share\..."): check the raw string for a
    // leading "\\" and also check after normalizing backslashes to forward
    // slashes, so this doesn't depend on backslash-normalization having run
    // first (or at all) elsewhere.
    if (candidate.startsWith('\\\\')) return true;
    const normalized = candidate.replace(/\\/g, '/');
    if (normalized.startsWith('//')) return true;
    // Absolute filesystem-style path.
    if (normalized.startsWith('/')) return true;
    // Path traversal segments, normalizing backslashes first since some zip
    // tools on Windows emit them as separators.
    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '..')) return true;
    return false;
  };

  if (looksUnsafeRaw(path)) return true;

  // Percent-encoded (possibly multiple times, e.g. "%252e%252e%252f" is
  // "../" encoded twice) traversal: decode repeatedly until the string
  // stops changing, then re-run the same checks against the fully-decoded
  // form. A malformed encoding can't be proven safe, so treat decode
  // failure as unsafe-by-default. Cap the number of iterations so a
  // pathological input (e.g. deeply nested encoding) can't be used as a
  // decode-bomb DoS; if the string is STILL changing once the cap is hit,
  // it can't be proven safe either, so reject it the same way.
  const MAX_DECODE_ITERATIONS = 5;
  let current = path;
  for (let i = 0; i < MAX_DECODE_ITERATIONS; i++) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(current);
    } catch {
      return true;
    }
    if (decoded === current) {
      // Fully decoded (fixed point reached before hitting the cap).
      if (current !== path && looksUnsafeRaw(current)) return true;
      return false;
    }
    current = decoded;
  }
  // Still changing after MAX_DECODE_ITERATIONS passes — can't prove this is
  // safe, so reject by default (same posture as a decode throw above).
  return true;
}

/** Parses a SCORM .zip, uploads every contained file to the scorm-packages
 *  bucket at `<userId>/<packageId>/<relative_path>`, and returns manifest
 *  info to store on the Lesson. Throws ScormManifestError for a missing or
 *  invalid imsmanifest.xml (or a manifest/zip that attempts path traversal),
 *  or Error if the zip itself can't be read. */
export async function importScormPackage(file: File, userId: string): Promise<ScormImportResult> {
  if (file.size > MAX_PACKAGE_BYTES) {
    throw new Error(`Package trop volumineux (max ${Math.round(MAX_PACKAGE_BYTES / 1024 / 1024)} Mo).`);
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const manifestFile = zip.file('imsmanifest.xml');
  if (!manifestFile) throw new ScormManifestError("imsmanifest.xml introuvable à la racine du package.");

  const manifestXml = await manifestFile.async('text');
  const manifest = parseScormManifest(manifestXml);

  // The launchPath comes from an untrusted <resource href="..."> attribute
  // inside the package's own manifest. It later becomes part of the iframe
  // src built by ScormPlayer (/scorm-content/<userId>/<packageId>/<launchPath>),
  // so a `../` traversal or absolute URL/path here could point the iframe
  // outside the package's own uploaded prefix. Reject before returning.
  if (isUnsafeRelativePath(manifest.launchPath)) {
    throw new ScormManifestError(
      `Chemin de lancement invalide dans imsmanifest.xml : "${manifest.launchPath}" (chemins absolus et "../" interdits).`,
    );
  }

  const packageId = genId();
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);

  // Zip-slip guard: entry.name is similarly attacker-influenced (a crafted
  // zip could contain an entry literally named "../../../etc/passwd") and is
  // used to build this package's Storage path below — reject any entry that
  // looks like a traversal attempt before uploading anything.
  for (const entry of entries) {
    if (isUnsafeRelativePath(entry.name)) {
      throw new Error(
        `Le package SCORM contient une entrée de fichier invalide : "${entry.name}" (chemins absolus et "../" interdits).`,
      );
    }
  }

  const bucket = supabase.storage.from('scorm-packages');
  for (const entry of entries) {
    const bytes = await entry.async('arraybuffer');
    const path = `${userId}/${packageId}/${entry.name}`;
    const { error } = await bucket.upload(path, bytes, {
      upsert: true,
      contentType: guessContentType(entry.name),
    });
    if (error) throw error;
  }

  return { packageId, version: manifest.version, launchPath: manifest.launchPath, title: manifest.title };
}
