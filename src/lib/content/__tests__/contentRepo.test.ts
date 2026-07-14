import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase';
import {
  listContent,
  getContent,
  createContent,
  updateContent,
  removeContent,
  moveContent,
  setPublic,
  setOpen,
} from '../contentRepo';

// Mock the Supabase client. `from()` returns a chainable builder whose methods
// all return the same builder; the builder is thenable so `await`-ing it at any
// terminal method (.order/.single/.maybeSingle/.eq/.delete) resolves the
// configured { data, error } result.
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
}));

type Result = { data: unknown; error: unknown };

function makeBuilder(result: Result) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (r: Result) => unknown) => unknown;
  } = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve) => resolve(result),
  } as never;
  return builder;
}

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  fromMock.mockReset();
});

describe('contentRepo', () => {
  it('createContent inserts { user_id, type, data, folder_id } and returns the mapped row', async () => {
    const row = {
      id: 'r1',
      user_id: 'u1',
      type: 'quiz',
      folder_id: 'f1',
      data: { title: 'Q' },
      is_public: false,
      is_open: false,
      created_at: 't',
      updated_at: 't',
    };
    const builder = makeBuilder({ data: row, error: null });
    fromMock.mockReturnValue(builder);

    const result = await createContent('u1', 'quiz', { title: 'Q' }, 'f1');

    expect(fromMock).toHaveBeenCalledWith('content');
    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'quiz',
      data: { title: 'Q' },
      folder_id: 'f1',
      source_id: null,
    });
    expect(builder.select).toHaveBeenCalled();
    expect(builder.single).toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it('createContent defaults folder_id to null when omitted', async () => {
    const builder = makeBuilder({ data: {}, error: null });
    fromMock.mockReturnValue(builder);

    await createContent('u1', 'poll', { q: 1 });

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      type: 'poll',
      data: { q: 1 },
      folder_id: null,
      source_id: null,
    });
  });

  it('listContent filters by user_id and type and orders by updated_at desc', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const builder = makeBuilder({ data: rows, error: null });
    fromMock.mockReturnValue(builder);

    const result = await listContent('u1', 'quiz');

    expect(fromMock).toHaveBeenCalledWith('content');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(builder.eq).toHaveBeenCalledWith('type', 'quiz');
    expect(builder.order).toHaveBeenCalledWith('updated_at', { ascending: false });
    expect(builder.is).not.toHaveBeenCalled();
    expect(result).toEqual(rows);
  });

  it('listContent filters folder_id IS NULL when folderId is null', async () => {
    const builder = makeBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listContent('u1', 'quiz', null);

    expect(builder.is).toHaveBeenCalledWith('folder_id', null);
  });

  it('listContent filters folder_id equals when folderId is a string', async () => {
    const builder = makeBuilder({ data: [], error: null });
    fromMock.mockReturnValue(builder);

    await listContent('u1', 'quiz', 'f1');

    expect(builder.eq).toHaveBeenCalledWith('folder_id', 'f1');
    expect(builder.is).not.toHaveBeenCalled();
  });

  it('getContent returns null when the row is not found', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    const result = await getContent('missing');

    expect(builder.eq).toHaveBeenCalledWith('id', 'missing');
    expect(builder.maybeSingle).toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('updateContent updates the patched columns by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await updateContent('r1', { is_public: true, data: { x: 1 } });

    expect(builder.update).toHaveBeenCalledWith({ is_public: true, data: { x: 1 } });
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('removeContent deletes by id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await removeContent('r1');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('moveContent updates folder_id', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await moveContent('r1', 'f2');

    expect(builder.update).toHaveBeenCalledWith({ folder_id: 'f2' });
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('setPublic updates is_public', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await setPublic('r1', true);

    expect(builder.update).toHaveBeenCalledWith({ is_public: true });
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('setOpen updates is_open', async () => {
    const builder = makeBuilder({ data: null, error: null });
    fromMock.mockReturnValue(builder);

    await setOpen('r1', false);

    expect(builder.update).toHaveBeenCalledWith({ is_open: false });
    expect(builder.eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('throws when the client returns an error', async () => {
    const err = new Error('db failure');
    const builder = makeBuilder({ data: null, error: err });
    fromMock.mockReturnValue(builder);

    await expect(listContent('u1', 'quiz')).rejects.toBe(err);
  });
});
