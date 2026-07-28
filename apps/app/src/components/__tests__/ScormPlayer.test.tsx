import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ScormPlayer } from '../ScormPlayer';
import { upsertScormTracking } from '@/lib/scormTracking';

vi.mock('@/lib/scormTracking', () => ({ upsertScormTracking: vi.fn(async () => {}) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

afterEach(() => {
  cleanup();
  delete (window as unknown as Record<string, unknown>).API;
  delete (window as unknown as Record<string, unknown>).API_1484_11;
});

describe('ScormPlayer', () => {
  it('mounts window.API for a 1.2 package and points the iframe at the package owner\'s proxy path', () => {
    const { container } = render(
      <ScormPlayer
        userId="learner-1"
        packageOwnerId="owner-1"
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

    // Iframe path is keyed by the package OWNER's storage prefix, not the
    // current learner — a shared/public course is viewed by learners other
    // than its author, but the package was uploaded under the author's id.
    const iframe = container.querySelector('iframe');
    expect(iframe?.getAttribute('src')).toBe('/scorm-content/owner-1/pkg-1/index_lms.html');
  });

  it('mounts window.API_1484_11 for a 2004 package', () => {
    render(
      <ScormPlayer
        userId="learner-1"
        packageOwnerId="owner-1"
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

  it('persists tracking under the current learner\'s id, not the package owner\'s', () => {
    render(
      <ScormPlayer
        userId="learner-1"
        packageOwnerId="owner-1"
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
        userId: 'learner-1', localCourseId: 'course-1', lessonId: 'lesson-1',
        scormVersion: '2004', completionStatus: 'completed',
      }),
    );
    // The tracking call must never carry the package owner's id as the
    // learner identity — this is the exact bug a prior review caught.
    expect(vi.mocked(upsertScormTracking).mock.calls[0][0].userId).not.toBe('owner-1');
  });

  it('shows an error toast when persisting tracking fails', async () => {
    vi.mocked(upsertScormTracking).mockRejectedValueOnce(new Error('network error'));
    const { toast } = await import('sonner');

    render(
      <ScormPlayer
        userId="learner-1"
        packageOwnerId="owner-1"
        localCourseId="course-1"
        lessonId="lesson-1"
        scormVersion="2004"
        packageId="pkg-2"
        launchPath="story.html"
        initialState={{}}
      />,
    );
    const api = (window as unknown as { API_1484_11: { Initialize: (p: string) => string; Commit: (p: string) => string } }).API_1484_11;
    api.Initialize('');
    api.Commit('');

    await vi.waitFor(() => {
      expect(vi.mocked(toast.error)).toHaveBeenCalled();
    });
  });
});
