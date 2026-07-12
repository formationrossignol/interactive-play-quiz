import { describe, expect, it } from 'vitest';
import { assertSafeImportFile } from '../fileValidation';

function makeFile(sizeBytes: number, name = 'questions.xlsx'): File {
  return new File([new Uint8Array(sizeBytes)], name);
}

describe('assertSafeImportFile', () => {
  it('accepts a file under the size limit', () => {
    expect(() => assertSafeImportFile(makeFile(1024))).not.toThrow();
  });

  it('rejects a file over 5MB', () => {
    expect(() => assertSafeImportFile(makeFile(6 * 1024 * 1024))).toThrow(/trop volumineux/i);
  });

  it('accepts a file at exactly 5MB (boundary is exclusive)', () => {
    expect(() => assertSafeImportFile(makeFile(5 * 1024 * 1024))).not.toThrow();
  });

  it('rejects a file over a custom maxBytes override even though it is under the 5MB default', () => {
    expect(() =>
      assertSafeImportFile(makeFile(2 * 1024 * 1024), 1 * 1024 * 1024)
    ).toThrow(/trop volumineux/i);
  });
});
