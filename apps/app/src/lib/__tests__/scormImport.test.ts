import { describe, expect, it, vi, beforeEach } from 'vitest';
import JSZip from 'jszip';
import { importScormPackage } from '../scormImport';
import { supabase } from '../supabase';

vi.mock('../supabase', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(async () => ({ error: null })),
      })),
    },
  },
}));

const MANIFEST = `<?xml version="1.0"?>
<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1"><title>Test Course</title>
      <item identifier="ITEM1" identifierref="RES1"/>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" href="index.html"><file href="index.html"/></resource>
  </resources>
</manifest>`;

function manifestWithLaunchPath(launchPath: string): string {
  return `<?xml version="1.0"?>
<manifest xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata><schemaversion>1.2</schemaversion></metadata>
  <organizations default="ORG1">
    <organization identifier="ORG1"><title>Test Course</title>
      <item identifier="ITEM1" identifierref="RES1"/>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES1" href="${launchPath}"><file href="${launchPath}"/></resource>
  </resources>
</manifest>`;
}

async function buildZip(): Promise<File> {
  const zip = new JSZip();
  zip.file('imsmanifest.xml', MANIFEST);
  zip.file('index.html', '<html><body>SCO</body></html>');
  zip.file('assets/style.css', 'body { color: red; }');
  const buffer = await zip.generateAsync({ type: 'arraybuffer' });
  return new File([buffer], 'course.zip', { type: 'application/zip' });
}

beforeEach(() => {
  vi.mocked(supabase.storage.from).mockClear();
});

describe('importScormPackage', () => {
  it('uploads every file in the zip and returns manifest info', async () => {
    const file = await buildZip();
    const result = await importScormPackage(file, 'user-1');

    expect(result.version).toBe('1.2');
    expect(result.launchPath).toBe('index.html');
    expect(result.title).toBe('Test Course');
    expect(result.packageId).toMatch(/^[a-z0-9]+$/);

    const fromMock = vi.mocked(supabase.storage.from);
    expect(fromMock).toHaveBeenCalledWith('scorm-packages');
    // imsmanifest.xml + index.html + assets/style.css = 3 uploads
    const uploadMock = fromMock.mock.results[0].value.upload;
    expect(uploadMock).toHaveBeenCalledTimes(3);
    expect(uploadMock.mock.calls.map((c: unknown[]) => c[0])).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`user-1/${result.packageId}/imsmanifest.xml`),
        expect.stringContaining(`user-1/${result.packageId}/index.html`),
        expect.stringContaining(`user-1/${result.packageId}/assets/style.css`),
      ]),
    );
  });

  it('guesses text/html for an uppercase-extension entry (INDEX.HTML)', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', MANIFEST);
    zip.file('index.html', '<html><body>SCO</body></html>');
    zip.file('assets/INDEX.HTML', '<html><body>Upper</body></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'uppercase.zip', { type: 'application/zip' });

    const result = await importScormPackage(file, 'user-1');

    const fromMock = vi.mocked(supabase.storage.from);
    const uploadMock = fromMock.mock.results[0].value.upload;
    const uppercaseCall = uploadMock.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes(`user-1/${result.packageId}/assets/INDEX.HTML`),
    );
    expect(uppercaseCall).toBeDefined();
    expect(uppercaseCall![2]).toMatchObject({ contentType: 'text/html' });
  });

  it('rejects a zip with no imsmanifest.xml', async () => {
    const zip = new JSZip();
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'bad.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/imsmanifest\.xml/);
  });

  it('rejects a manifest whose launchPath traverses outside the package (../)', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('../../other-package/secret.html'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a manifest whose launchPath is an absolute URL', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('https://evil.example.com/phish.html'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil2.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a manifest whose launchPath is an absolute path', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('/etc/passwd'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil3.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a manifest whose launchPath is percent-encoded traversal (..%2F)', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('..%2Fescape.html'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil4.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a manifest whose launchPath is a UNC-style path', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('\\\\server\\evil.html'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil5.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a manifest whose launchPath is double percent-encoded traversal (%252e%252e%252f)', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', manifestWithLaunchPath('%252e%252e%252fescape.html'));
    zip.file('index.html', '<html></html>');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil6.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/launchPath|href|chemin/i);
  });

  it('rejects a zip containing an entry whose name is double percent-encoded traversal (%252e%252e%252f)', async () => {
    const zip = new JSZip();
    zip.file('imsmanifest.xml', MANIFEST);
    zip.file('index.html', '<html><body>SCO</body></html>');
    zip.file('%252e%252e%252fescape.html', 'pwned');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'evil7.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/entr|chemin|path/i);
  });

  it('rejects a zip containing an entry with an absolute path (zip slip)', async () => {
    // JSZip's own file()/loadAsync round-trip preserves a literal absolute
    // entry name like "/etc/passwd" unchanged (verified directly: no
    // byte-patching workaround needed here, unlike a "../"-based entry name
    // which JSZip does normalize away).
    const zip = new JSZip();
    zip.file('imsmanifest.xml', MANIFEST);
    zip.file('index.html', '<html><body>SCO</body></html>');
    zip.file('/etc/passwd', 'pwned');
    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const file = new File([buffer], 'zipslip.zip', { type: 'application/zip' });

    await expect(importScormPackage(file, 'user-1')).rejects.toThrow(/entr|chemin|path/i);
  });
});
