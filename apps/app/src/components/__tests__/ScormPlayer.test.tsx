import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ScormPlayer } from '../ScormPlayer';
import { upsertScormTracking } from '@/lib/scormTracking';

vi.mock('@/lib/scormTracking', () => ({ upsertScormTracking: vi.fn(async () => {}) }));

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).API;
  delete (window as unknown as Record<string, unknown>).API_1484_11;
});

describe('ScormPlayer', () => {
  it('mounts window.API for a 1.2 package and points the iframe at the proxy path', () => {
    const { container } = render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="1.2"
        packageId="pkg-1"
        launchPath="index_lms.html"
        initialState={{}}
      />,
    );

    expect(typeof (window as unknown as { API?: unknown }).API).toBe('object');
    expect((window as unknown as { API_1484_11?: unknown }).API_1484_11).toBeUndefined();

    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('/scorm-content/user-1/pkg-1/index_lms.html');
  });

  it('mounts window.API_1484_11 for a 2004 package', () => {
    render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="2004"
        packageId="pkg-2"
        launchPath="story.html"
        initialState={{}}
      />,
    );
    expect(typeof (window as unknown as { API_1484_11?: unknown }).API_1484_11).toBe('object');
  });

  it('persists tracking state when the SCO calls Commit', () => {
    render(
      <ScormPlayer
        userId="user-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="2004"
        packageId="pkg-2"
        launchPath="story.html"
        initialState={{}}
      />,
    );
    const api = (window as unknown as { API_1484_11: { Initialize: (p: string) => string; SetValue: (n: string, v: string) => string; Commit: (p: string) => string } }).API_1484_11;
    api.Initialize('');
    api.SetValue('cmi.completion_status', 'completed');
    api.Commit('');

    expect(vi.mocked(upsertScormTracking)).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1', localCourseId: 'course-1', lessonId: 'lesson-1',
        scormVersion: '2004', completionStatus: 'completed',
      }),
    );
  });
});
