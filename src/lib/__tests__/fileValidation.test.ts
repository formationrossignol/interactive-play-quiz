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
});
