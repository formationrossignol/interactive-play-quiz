import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PROCTORING_CONFIG,
  applyProctoringLevel,
  normalizeProctoringConfig,
} from '../proctoring';

vi.mock('../supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

describe('proctoring configuration', () => {
  it('keeps legacy exams fully optional', () => {
    expect(normalizeProctoringConfig(null)).toMatchObject({
      enabled: false,
      level: 'none',
      sebRequired: false,
      webcamRequired: false,
      microphoneRequired: false,
      screenshotMode: 'none',
    });
  });

  it('applies the reinforced preset without losing organization tolerances', () => {
    const configured = {
      ...DEFAULT_PROCTORING_CONFIG,
      maxTabSwitches: 7,
      retentionDays: 30,
    };
    const result = applyProctoringLevel(configured, 'enhanced');
    expect(result).toMatchObject({
      enabled: true,
      level: 'enhanced',
      sebRequired: true,
      webcamRequired: true,
      microphoneRequired: true,
      screenshotMode: 'periodic',
      aiAnalysis: true,
      maxTabSwitches: 7,
      retentionDays: 30,
    });
  });

  it('disables every intrusive source when the level is reset to none', () => {
    const result = applyProctoringLevel(
      applyProctoringLevel(DEFAULT_PROCTORING_CONFIG, 'enhanced'),
      'none',
    );
    expect(result).toMatchObject({
      enabled: false,
      level: 'none',
      sebRequired: false,
      webcamRequired: false,
      microphoneRequired: false,
      screenshotMode: 'none',
      aiAnalysis: false,
    });
  });
});
