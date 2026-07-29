import JSZip, { type JSZipObject } from 'jszip';
import { supabase, supabaseUrl } from './supabase';

export const H5P_BUCKET = 'h5p-packages';
export const H5P_MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
export const H5P_MAX_EXTRACTED_BYTES = 300 * 1024 * 1024;
export const H5P_MAX_FILES = 5_000;

const ALLOWED_EXTENSIONS = new Set([
  'bmp', 'css', 'csv', 'diff', 'doc', 'docx', 'eof', 'gif', 'jpeg', 'jpg',
  'js', 'json', 'm4a', 'md', 'mp3', 'mp4', 'odp', 'ods', 'odt', 'ogg', 'otf',
  'patch', 'pdf', 'png', 'ppt', 'pptx', 'rtf', 'svg', 'textile', 'tif', 'tiff',
  'ttf', 'txt', 'vtt', 'wav', 'webm', 'woff', 'woff2', 'xls', 'xlsx', 'xml',
]);

const CONTENT_TYPES: Record<string, string> = {
  bmp: 'image/bmp',
  css: 'text/css; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  js: 'text/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8',
  m4a: 'audio/mp4',
  md: 'text/markdown; charset=utf-8',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  ogg: 'audio/ogg',
  otf: 'font/otf',
  pdf: 'application/pdf',
  png: 'image/png',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  vtt: 'text/vtt; charset=utf-8',
  wav: 'audio/wav',
  webm: 'video/webm',
  woff: 'font/woff',
  woff2: 'font/woff2',
  xml: 'application/xml; charset=utf-8',
};

export interface H5pDependency {
  machineName: string;
  majorVersion: number;
  minorVersion: number;
}

export interface H5pPackageDefinition {
  title: string;
  language: string;
  mainLibrary: string;
  embedTypes: Array<'div' | 'iframe'>;
  preloadedDependencies: H5pDependency[];
}

export interface H5pPackageInfo {
  title: string;
  language: string;
  mainLibrary: string;
  fileCount: number;
  archiveSize: number;
}

export interface H5pImportResult extends H5pPackageInfo {
  packageId: string;
  ownerId: string;
  originalName: string;
  importedAt: string;
}

export type H5pImportProgress = {
  uploaded: number;
  total: number;
  percent: number;
};

export class H5pImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'H5pImportError';
  }
}

const extensionOf = (path: string): string => {
  const fileName = path.split('/').pop() ?? '';
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot + 1).toLowerCase() : '';
};

const assertSafePath = (entry: JSZipObject): void => {
  const original = (entry as JSZipObject & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
  const normalized = original.replace(/\\/g, '/');
  if (
    normalized.startsWith('/')
    || /^[a-zA-Z]:\//.test(normalized)
    || normalized.split('/').some((part) => part === '..')
  ) {
    throw new H5pImportError(`Chemin non sécurisé dans le paquet : ${original}`);
  }
};

const parseJson = <T>(raw: string, fileName: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new H5pImportError(`${fileName} contient un JSON invalide.`);
  }
};

const assertDefinition = (definition: Partial<H5pPackageDefinition>): H5pPackageDefinition => {
  if (!definition.title?.trim()) throw new H5pImportError('Le champ "title" manque dans h5p.json.');
  if (!definition.mainLibrary?.trim()) throw new H5pImportError('Le champ "mainLibrary" manque dans h5p.json.');
  if (!definition.language?.trim()) throw new H5pImportError('Le champ "language" manque dans h5p.json.');
  if (!Array.isArray(definition.embedTypes) || definition.embedTypes.length === 0) {
    throw new H5pImportError('Le champ "embedTypes" manque dans h5p.json.');
  }
  if (!Array.isArray(definition.preloadedDependencies) || definition.preloadedDependencies.length === 0) {
    throw new H5pImportError('Aucune dépendance H5P n’est déclarée dans h5p.json.');
  }
  if (!definition.preloadedDependencies.some((dependency) => dependency.machineName === definition.mainLibrary)) {
    throw new H5pImportError('La bibliothèque principale n’est pas déclarée dans preloadedDependencies.');
  }
  return definition as H5pPackageDefinition;
};

const findLibraryDefinition = async (
  files: JSZipObject[],
  machineName: string,
): Promise<boolean> => {
  const candidates = files.filter((entry) => !entry.dir && entry.name.endsWith('/library.json'));
  for (const candidate of candidates) {
    const library = parseJson<{ machineName?: string }>(await candidate.async('string'), candidate.name);
    if (library.machineName === machineName) return true;
  }
  return false;
};

export async function inspectH5pPackage(file: File): Promise<{
  zip: JSZip;
  files: JSZipObject[];
  definition: H5pPackageDefinition;
  info: H5pPackageInfo;
}> {
  if (!file.name.toLowerCase().endsWith('.h5p')) {
    throw new H5pImportError('Sélectionnez un fichier avec l’extension .h5p.');
  }
  if (file.size === 0) throw new H5pImportError('Le fichier H5P est vide.');
  if (file.size > H5P_MAX_ARCHIVE_BYTES) {
    throw new H5pImportError('Le fichier H5P dépasse la taille maximale de 100 Mo.');
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new H5pImportError('Le fichier .h5p n’est pas une archive ZIP valide.');
  }

  const entries = Object.values(zip.files);
  entries.forEach(assertSafePath);
  const files = entries.filter((entry) => !entry.dir && !entry.name.startsWith('__MACOSX/'));
  if (files.length > H5P_MAX_FILES) {
    throw new H5pImportError(`Le paquet contient trop de fichiers (${files.length}, maximum ${H5P_MAX_FILES}).`);
  }

  for (const entry of files) {
    const extension = extensionOf(entry.name);
    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      throw new H5pImportError(`Type de fichier non autorisé dans le paquet : ${entry.name}`);
    }
  }

  const h5pJson = zip.file('h5p.json');
  const contentJson = zip.file('content/content.json');
  if (!h5pJson) throw new H5pImportError('h5p.json est introuvable à la racine du paquet.');
  if (!contentJson) throw new H5pImportError('content/content.json est introuvable dans le paquet.');

  const definition = assertDefinition(
    parseJson<Partial<H5pPackageDefinition>>(await h5pJson.async('string'), 'h5p.json'),
  );
  parseJson<Record<string, unknown>>(await contentJson.async('string'), 'content/content.json');

  if (!(await findLibraryDefinition(files, definition.mainLibrary))) {
    throw new H5pImportError(
      `La bibliothèque principale ${definition.mainLibrary} n’est pas incluse dans le paquet. `
      + 'Exportez une version contenant toutes les bibliothèques nécessaires.',
    );
  }

  return {
    zip,
    files,
    definition,
    info: {
      title: definition.title.trim(),
      language: definition.language,
      mainLibrary: definition.mainLibrary,
      fileCount: files.length,
      archiveSize: file.size,
    },
  };
}

const contentTypeFor = (path: string): string =>
  CONTENT_TYPES[extensionOf(path)] ?? 'application/octet-stream';

const createPackageId = (): string =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export async function importH5pPackage(
  file: File,
  ownerId: string,
  onProgress?: (progress: H5pImportProgress) => void,
): Promise<H5pImportResult> {
  if (!ownerId) throw new H5pImportError('Vous devez être connecté pour importer un paquet H5P.');
  const { files, info } = await inspectH5pPackage(file);
  const packageId = createPackageId();
  const prefix = `${ownerId}/${packageId}`;
  const uploadedPaths: string[] = [];
  let extractedBytes = 0;
  let cursor = 0;
  let aborted = false;

  const uploadNext = async (): Promise<void> => {
    while (!aborted && cursor < files.length) {
      const index = cursor++;
      const entry = files[index];
      try {
        const bytes = await entry.async('uint8array');
        extractedBytes += bytes.byteLength;
        if (extractedBytes > H5P_MAX_EXTRACTED_BYTES) {
          throw new H5pImportError('Le contenu décompressé dépasse la limite de sécurité de 300 Mo.');
        }

        const storagePath = `${prefix}/${entry.name}`;
        const { error } = await supabase.storage.from(H5P_BUCKET).upload(storagePath, bytes, {
          contentType: contentTypeFor(entry.name),
          cacheControl: '31536000',
          upsert: false,
        });
        if (error) throw new H5pImportError(`Échec de l’envoi de ${entry.name} : ${error.message}`);
        uploadedPaths.push(storagePath);
        onProgress?.({
          uploaded: uploadedPaths.length,
          total: files.length,
          percent: Math.round((uploadedPaths.length / files.length) * 100),
        });
      } catch (error) {
        aborted = true;
        throw error;
      }
    }
  };

  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(4, files.length) }, () => uploadNext()),
  );
  const failed = workers.find((worker): worker is PromiseRejectedResult => worker.status === 'rejected');
  if (failed) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(H5P_BUCKET).remove(uploadedPaths);
    }
    throw failed.reason;
  }

  return {
    ...info,
    packageId,
    ownerId,
    originalName: file.name,
    importedAt: new Date().toISOString(),
  };
}

export function getH5pContentPath(ownerId: string, packageId: string): string {
  const encodedOwner = encodeURIComponent(ownerId);
  const encodedPackage = encodeURIComponent(packageId);
  if (import.meta.env.DEV) {
    return `${supabaseUrl}/storage/v1/object/public/${H5P_BUCKET}/${encodedOwner}/${encodedPackage}`;
  }
  return `/h5p-content/${encodedOwner}/${encodedPackage}`;
}
