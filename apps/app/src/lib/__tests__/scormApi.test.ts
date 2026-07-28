import { describe, it, expect, vi } from 'vitest';
import { createScormApi } from '../scormApi';

describe('createScormApi — SCORM 1.2', () => {
  it('supports the LMSInitialize/GetValue/SetValue/Commit/Finish lifecycle', () => {
    const onCommit = vi.fn();
    const api = createScormApi('1.2', {}, onCommit);

    expect(api.LMSInitialize('')).toBe('true');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('not attempted');

    expect(api.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('true');
    expect(api.LMSSetValue('cmi.core.score.raw', '85')).toBe('true');
    expect(api.LMSGetValue('cmi.core.lesson_status')).toBe('completed');

    expect(api.LMSCommit('')).toBe('true');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({ lessonStatus: 'completed', scoreRaw: 85 }));

    expect(api.LMSFinish('')).toBe('true');
    expect(onCommit).toHaveBeenCalledTimes(2); // Commit + Finish both flush
  });

  it('rejects SetValue before Initialize with error 301', () => {
    const api = createScormApi('1.2', {}, vi.fn());
    expect(api.LMSSetValue('cmi.core.lesson_status', 'completed')).toBe('false');
    expect(api.LMSGetLastError()).toBe('301');
  });

  it('records interactions written via cmi.interactions.n.*', () => {
    const onCommit = vi.fn();
    const api = createScormApi('1.2', {}, onCommit);
    api.LMSInitialize('');
    api.LMSSetValue('cmi.interactions.0.id', 'q1');
    api.LMSSetValue('cmi.interactions.0.type', 'choice');
    api.LMSSetValue('cmi.interactions.0.student_response', 'b');
    api.LMSSetValue('cmi.interactions.0.result', 'correct');
    api.LMSCommit('');

    const [state] = onCommit.mock.calls[0];
    expect(state.interactions).toEqual([
      expect.objectContaining({ id: 'q1', type: 'choice', learnerResponse: 'b', result: 'correct' }),
    ]);
  });
});

describe('createScormApi — SCORM 2004', () => {
  it('supports Initialize/GetValue/SetValue/Commit/Terminate under the 2004 method names', () => {
    const onCommit = vi.fn();
    const api = createScormApi('2004', {}, onCommit);

    expect(api.Initialize('')).toBe('true');
    expect(api.SetValue('cmi.completion_status', 'completed')).toBe('true');
    expect(api.SetValue('cmi.success_status', 'passed')).toBe('true');
    expect(api.SetValue('cmi.score.scaled', '0.9')).toBe('true');
    expect(api.Commit('')).toBe('true');
    expect(onCommit).toHaveBeenCalledWith(expect.objectContaining({
      completionStatus: 'completed', successStatus: 'passed', scoreScaled: 0.9,
    }));
    expect(api.Terminate('')).toBe('true');
  });

  it('seeds GetValue from initial tracking state (resume)', () => {
    const api = createScormApi('2004', { suspendData: '{"page":3}', completionStatus: 'incomplete' }, vi.fn());
    api.Initialize('');
    expect(api.GetValue('cmi.suspend_data')).toBe('{"page":3}');
    expect(api.GetValue('cmi.completion_status')).toBe('incomplete');
  });
});
