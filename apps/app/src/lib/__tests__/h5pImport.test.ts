import JSZip from 'jszip';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  H5pImportError,
  importH5pPackage,
  inspectH5pPackage,
} from '../h5pImport';

const { uploadMock, removeMock, fromMock } = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  return {
    uploadMock: upload,
    removeMock: remove,
    fromMock: vi.fn(() => ({ upload, remove })),
  };
});

vi.mock('../supabase', () => ({
  supabase: { storage: { from: fromMock } },
  supabaseUrl: 'https://example.supabase.co',
}));

async function makePackage(options?: {
  includeContent?: boolean;
  includeLibrary?: boolean;
  extraFile?: { name: string; content: string };
}): Promise<File> {
  const zip = new JSZip();
  zip.file('h5p.json', JSON.stringify({
    title: 'Questionnaire sécurité',
    language: 'fr',
    mainLibrary: 'H5P.MultiChoice',
    embedTypes: ['div'],
    preloadedDependencies: [
      { machineName: 'H5P.MultiChoice', majorVersion: 1, minorVersion: 16 },
    ],
  }));
  if (options?.includeContent !== false) {
    zip.file('content/content.json', JSON.stringify({ question: 'Question ?' }));
  }
  if (options?.includeLibrary !== false) {
    zip.file('H5P.MultiChoice-1.16/library.json', JSON.stringify({
      title: 'Multiple Choice',
      machineName: 'H5P.MultiChoice',
      majorVersion: 1,
      minorVersion: 16,
      patchVersion: 0,
      runnable: 1,
      preloadedJs: [{ path: 'scripts/multichoice.js' }],
    }));
    zip.file('H5P.MultiChoice-1.16/scripts/multichoice.js', 'window.H5P = window.H5P || {};');
  }
  if (options?.extraFile) zip.file(options.extraFile.name, options.extraFile.content);
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([bytes], 'questionnaire.h5p', { type: 'application/zip' });
}

beforeEach(() => {
  vi.clearAllMocks();
  uploadMock.mockResolvedValue({ error: null });
  removeMock.mockResolvedValue({ error: null });
  vi.stubGlobal('crypto', { randomUUID: () => 'package-123' });
});

describe('inspectH5pPackage', () => {
  it('reads metadata from a valid complete package', async () => {
    const result = await inspectH5pPackage(await makePackage());

    expect(result.info).toMatchObject({
      title: 'Questionnaire sécurité',
      language: 'fr',
      mainLibrary: 'H5P.MultiChoice',
    });
    expect(result.info.fileCount).toBe(4);
  });

  it('rejects a package without content/content.json', async () => {
    await expect(inspectH5pPackage(await makePackage({ includeContent: false })))
      .rejects.toThrow(/content\/content\.json/);
  });

  it('rejects a package without its main library', async () => {
    await expect(inspectH5pPackage(await makePackage({ includeLibrary: false })))
      .rejects.toThrow(/bibliothèque principale/i);
  });

  it('rejects file types outside the H5P allowlist', async () => {
    await expect(inspectH5pPackage(await makePackage({
      extraFile: { name: 'content/payload.exe', content: 'not allowed' },
    }))).rejects.toBeInstanceOf(H5pImportError);
  });
});

describe('importH5pPackage', () => {
  it('uploads every extracted file under the authenticated owner prefix', async () => {
    const result = await importH5pPackage(await makePackage(), 'user-1');

    expect(fromMock).toHaveBeenCalledWith('h5p-packages');
    expect(uploadMock).toHaveBeenCalledTimes(4);
    expect(uploadMock.mock.calls.map(([path]) => path)).toContain(
      'user-1/package-123/content/content.json',
    );
    expect(result).toMatchObject({
      packageId: 'package-123',
      ownerId: 'user-1',
      title: 'Questionnaire sécurité',
      originalName: 'questionnaire.h5p',
    });
  });

  it('removes already uploaded files when a later upload fails', async () => {
    uploadMock
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValue({ error: { message: 'storage unavailable' } });

    await expect(importH5pPackage(await makePackage(), 'user-1')).rejects.toThrow(/Échec de l’envoi/);
    expect(removeMock).toHaveBeenCalled();
  });
});
