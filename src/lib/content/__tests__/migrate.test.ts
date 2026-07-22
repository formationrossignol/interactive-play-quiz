import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createFolder } from '../foldersRepo';
import { createContent } from '../contentRepo';
import { planMigration, migrateLocalToSupabase } from '../migrateLocalToSupabase';

// Mock the repos: both functions resolve to a minimal row. createFolder returns
// a deterministic id derived from its arguments so the temp->new remap is
// observable in the createContent calls.
vi.mock('../foldersRepo', () => ({
  createFolder: vi.fn(),
}));
vi.mock('../contentRepo', () => ({
  createContent: vi.fn(async () => ({ id: 'content-row' })),
}));
// migrateExamsAndAttempts writes straight to `exams`/`exam_attempts` via the
// raw client (there's no repo layer for those yet) — stub it so a seeded
// lms_exams row never fires a real network call against the live project.
const { upsertMock, fromMock } = vi.hoisted(() => {
  const upsertMock = vi.fn(() => Promise.resolve({ data: null, error: null }));
  const fromMock = vi.fn(() => ({ upsert: upsertMock }));
  return { upsertMock, fromMock };
});
vi.mock('../../supabase', () => ({ supabase: { from: fromMock } }));

const createFolderMock = createFolder as unknown as ReturnType<typeof vi.fn>;
const createContentMock = createContent as unknown as ReturnType<typeof vi.fn>;

// Minimal in-memory localStorage stub.
function installLocalStorage(seed: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(seed));
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal('localStorage', mock);
  return store;
}

const USER = 'user-1';
const OTHER = 'user-2';

beforeEach(() => {
  createFolderMock.mockReset();
  createContentMock.mockReset();
  createContentMock.mockResolvedValue({ id: 'content-row' });
  fromMock.mockClear();
  upsertMock.mockClear();
  upsertMock.mockResolvedValue({ data: null, error: null });
  // createFolder returns a new id "new:<name>" so remapping is verifiable.
  createFolderMock.mockImplementation(async (_userId, _type, name) => ({
    id: `new:${name}`,
  }));
});

describe('planMigration (pure)', () => {
  it('includes only the current user\'s folders', () => {
    const plan = planMigration(
      {
        folders: [
          { id: 'f1', name: 'Mine', userId: USER, type: 'quiz', createdAt: 't' },
          { id: 'f2', name: 'Theirs', userId: OTHER, type: 'quiz', createdAt: 't' },
        ],
        savedQuizzes: [],
        exams: [],
        courses: [],
      },
      USER,
    );
    expect(plan.folders).toEqual([{ tempId: 'f1', type: 'quiz', name: 'Mine' }]);
  });

  it('skips soft-deleted quizzes and other users\', keeps the user\'s live ones (including slides)', () => {
    const plan = planMigration(
      {
        folders: [],
        savedQuizzes: [
          { id: 'q1', userId: USER, type: 'quiz', isPublic: true, folderId: 'f1' },
          { id: 'q2', userId: USER, type: 'slide', isPublic: false },
          { id: 'q3', userId: USER, type: 'quiz', deletedAt: '2026-01-01' },
          { id: 'q4', userId: OTHER, type: 'quiz' },
          { id: 'q5', userId: USER, type: 'poll', isPublic: false },
        ],
        exams: [],
        courses: [],
      },
      USER,
    );
    expect(plan.content.map((c) => (c.data as { id: string }).id)).toEqual(['q1', 'q2', 'q5']);
    expect(plan.content[0]).toMatchObject({
      type: 'quiz',
      isPublic: true,
      folderTempId: 'f1',
    });
    // whole original object is preserved in data
    expect(plan.content[0].data).toEqual({
      id: 'q1',
      userId: USER,
      type: 'quiz',
      isPublic: true,
      folderId: 'f1',
    });
  });

  it('defaults folderTempId to null when folderId is absent', () => {
    const plan = planMigration(
      {
        folders: [],
        savedQuizzes: [{ id: 'q1', userId: USER, type: 'quiz' }],
        exams: [],
        courses: [],
      },
      USER,
    );
    expect(plan.content[0].folderTempId).toBeNull();
  });

  it('matches exams by hostId and always marks them private with no folder', () => {
    const plan = planMigration(
      {
        folders: [],
        savedQuizzes: [],
        exams: [
          { id: 'e1', hostId: USER, title: 'Exam A' },
          { id: 'e2', hostId: OTHER, title: 'Exam B' },
          { id: 'e3', userId: USER, title: 'No hostId' },
        ],
        courses: [],
      },
      USER,
    );
    expect(plan.content).toEqual([
      {
        type: 'exam',
        data: { id: 'e1', hostId: USER, title: 'Exam A' },
        isPublic: false,
        folderTempId: null,
      },
    ]);
  });

  it('includes the user\'s live courses, skipping soft-deleted ones, propagating isPublic', () => {
    const plan = planMigration(
      {
        folders: [],
        savedQuizzes: [],
        exams: [],
        courses: [
          { id: 'c1', userId: USER, title: 'Live', isPublic: true },
          { id: 'c2', userId: USER, title: 'Deleted', deletedAt: 't' },
          { id: 'c3', userId: OTHER, title: 'Theirs' },
        ],
      },
      USER,
    );
    expect(plan.content).toEqual([
      {
        type: 'course',
        data: { id: 'c1', userId: USER, title: 'Live', isPublic: true },
        isPublic: true,
        folderTempId: null,
      },
    ]);
  });

  it('does not mutate its inputs', () => {
    const folders = [{ id: 'f1', name: 'Mine', userId: USER, type: 'quiz' }];
    const savedQuizzes = [{ id: 'q1', userId: USER, type: 'quiz', folderId: 'f1' }];
    const foldersCopy = structuredClone(folders);
    const quizzesCopy = structuredClone(savedQuizzes);
    planMigration({ folders, savedQuizzes, exams: [], courses: [] }, USER);
    expect(folders).toEqual(foldersCopy);
    expect(savedQuizzes).toEqual(quizzesCopy);
  });
});

describe('migrateLocalToSupabase (executor)', () => {
  it('no-ops when the migrated flag is already set', async () => {
    installLocalStorage({
      content_migrated_v1: '2026-01-01T00:00:00.000Z',
      saved_quizzes: JSON.stringify([{ id: 'q1', userId: USER, type: 'quiz' }]),
    });

    const result = await migrateLocalToSupabase(USER);

    expect(result).toEqual({ migrated: false, folders: 0, content: 0 });
    expect(createFolderMock).not.toHaveBeenCalled();
    expect(createContentMock).not.toHaveBeenCalled();
  });

  it('inserts folders for the user only and remaps content folder ids', async () => {
    const store = installLocalStorage({
      content_folders: JSON.stringify([
        { id: 'f1', name: 'Mine', userId: USER, type: 'quiz' },
        { id: 'f2', name: 'Theirs', userId: OTHER, type: 'quiz' },
      ]),
      saved_quizzes: JSON.stringify([
        { id: 'q1', userId: USER, type: 'quiz', isPublic: true, folderId: 'f1' },
        { id: 'q2', userId: USER, type: 'slide' },
        { id: 'q3', userId: USER, type: 'quiz', deletedAt: 't' },
        { id: 'q4', userId: USER, type: 'poll' },
      ]),
      lms_exams: JSON.stringify([{ id: 'e1', hostId: USER, title: 'E' }]),
      lms_courses: JSON.stringify([{ id: 'c1', userId: USER, isPublic: false }]),
    });

    const result = await migrateLocalToSupabase(USER);

    // one folder (the user's), and content: q1, q2 (slide), q4, e1, c1
    expect(result).toEqual({ migrated: true, folders: 1, content: 5 });

    expect(createFolderMock).toHaveBeenCalledTimes(1);
    expect(createFolderMock).toHaveBeenCalledWith(USER, 'quiz', 'Mine', null, 'f1');

    // q1 attached to the remapped folder id "new:Mine"; sourceId = q1's own id
    expect(createContentMock).toHaveBeenCalledWith(
      USER,
      'quiz',
      expect.objectContaining({ id: 'q1' }),
      'new:Mine',
      'q1',
    );
    // q4 has no folder -> null
    expect(createContentMock).toHaveBeenCalledWith(
      USER,
      'poll',
      expect.objectContaining({ id: 'q4' }),
      null,
      'q4',
    );
    // q2 (slide) is no longer skipped
    expect(createContentMock).toHaveBeenCalledWith(
      USER,
      'slide',
      expect.objectContaining({ id: 'q2' }),
      null,
      'q2',
    );

    // flag written, source keys untouched
    expect(store.get('content_migrated_v1')).toBeTruthy();
    expect(store.get('saved_quizzes')).toBeTruthy();
    expect(store.get('content_folders')).toBeTruthy();
  });

  it('also upserts the hosted exam and its attempts into the dedicated exam tables', async () => {
    installLocalStorage({
      lms_exams: JSON.stringify([
        { id: 'e1', hostId: USER, quizId: 'q1', title: 'E', description: '', openAt: 't1', closeAt: 't2',
          durationMinutes: null, maxAttempts: 1, shuffleQuestions: false, shuffleAnswers: false,
          passingScore: 70, showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
          scoreRetentionPolicy: 'best', status: 'draft', joinCode: 'ABC123', maxParticipants: 20 },
        { id: 'e2', hostId: OTHER, quizId: 'q9', title: 'Not mine', openAt: 't1', closeAt: 't2',
          maxAttempts: 1, passingScore: 70, showResultsPolicy: 'immediately', showDetailPolicy: 'score-only',
          scoreRetentionPolicy: 'best', status: 'draft', joinCode: 'ZZZ999' },
      ]),
      lms_exam_attempts: JSON.stringify([
        { id: 'a1', examId: 'e1', participantId: 'p1', participantName: 'P1', participantEmail: '',
          startedAt: 't1', submittedAt: null, timeUsedSeconds: 0, questionOrder: [], answers: {},
          score: null, percentage: null, passed: null, submissionMode: null, status: 'in-progress', logs: [] },
        { id: 'a2', examId: 'e2', participantId: 'p2', participantName: 'P2', participantEmail: '',
          startedAt: 't1', submittedAt: null, timeUsedSeconds: 0, questionOrder: [], answers: {},
          score: null, percentage: null, passed: null, submissionMode: null, status: 'in-progress', logs: [] },
      ]),
    });

    await migrateLocalToSupabase(USER);

    expect(fromMock).toHaveBeenCalledWith('exams');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e1', host_id: USER, quiz_id: 'q1', join_code: 'ABC123' }),
      { onConflict: 'id' },
    );
    // e2 (another host's exam) is never touched.
    expect(upsertMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'e2' }),
      expect.anything(),
    );

    expect(fromMock).toHaveBeenCalledWith('exam_attempts');
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a1', exam_id: 'e1', participant_id: 'p1' }),
      { onConflict: 'id' },
    );
    // a2 belongs to e2 (not this user's exam) — never migrated either.
    expect(upsertMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a2' }),
      expect.anything(),
    );
  });

  it('falls back to null when a content folderTempId has no mapped row', async () => {
    installLocalStorage({
      saved_quizzes: JSON.stringify([
        { id: 'q1', userId: USER, type: 'quiz', folderId: 'ghost' },
      ]),
    });

    await migrateLocalToSupabase(USER);

    expect(createContentMock).toHaveBeenCalledWith(
      USER,
      'quiz',
      expect.objectContaining({ id: 'q1' }),
      null,
      'q1',
    );
  });

  it('tolerates missing and malformed localStorage keys', async () => {
    installLocalStorage({ saved_quizzes: 'not json{' });

    const result = await migrateLocalToSupabase(USER);

    expect(result).toEqual({ migrated: true, folders: 0, content: 0 });
    expect(createContentMock).not.toHaveBeenCalled();
  });
});
