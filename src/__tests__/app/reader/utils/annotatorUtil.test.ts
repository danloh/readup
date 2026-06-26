import { describe, expect, it } from 'vitest';
import {
  decideAnnotationDraw,
  findAnnotationAtCfi,
  mergeRestyledAnnotation,
  removeEmptyAnnotationPlaceholder,
} from '@/app/read/utils/annotatorUtil';
import { BookNote } from '@/types/book';
import { NOTE_PREFIX } from '@/types/view';

const makeNote = (over: Partial<BookNote>): BookNote => ({
  id: 'id',
  type: 'annotation',
  cfi: 'epubcfi(/6/4!/4)',
  note: '',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('decideAnnotationDraw', () => {
  it('returns bubble for a note-prefixed overlay value regardless of style', () => {
    expect(decideAnnotationDraw(`${NOTE_PREFIX}epubcfi(/6/4!/4)`, 'highlight')).toBe('bubble');
    expect(decideAnnotationDraw(`${NOTE_PREFIX}epubcfi(/6/4!/4)`, undefined)).toBe('bubble');
  });

  it('returns the style kind for a plain cfi overlay value', () => {
    expect(decideAnnotationDraw('epubcfi(/6/4!/4)', 'highlight')).toBe('highlight');
    expect(decideAnnotationDraw('epubcfi(/6/4!/4)', 'underline')).toBe('underline');
    expect(decideAnnotationDraw('epubcfi(/6/4!/4)', 'squiggly')).toBe('squiggly');
  });

  it('returns none when there is no style and it is not a note overlay', () => {
    expect(decideAnnotationDraw('epubcfi(/6/4!/4)', undefined)).toBe('none');
    expect(decideAnnotationDraw(undefined, undefined)).toBe('none');
  });
});

describe('findAnnotationAtCfi', () => {
  it('finds the live annotation at the cfi', () => {
    const notes = [makeNote({ id: 'a', cfi: 'X' }), makeNote({ id: 'b', cfi: 'Y' })];
    expect(findAnnotationAtCfi(notes, 'Y')).toBe(1);
  });

  it('ignores deleted annotations and non-annotation types', () => {
    const notes = [
      makeNote({ id: 'a', cfi: 'X', deletedAt: 5 }),
      makeNote({ id: 'b', cfi: 'X', type: 'bookmark' }),
    ];
    expect(findAnnotationAtCfi(notes, 'X')).toBe(-1);
  });
});

describe('mergeRestyledAnnotation', () => {
  it('keeps the existing id, note, text, createdAt, and global while taking the new style/color', () => {
    const existing = makeNote({
      id: 'a',
      style: 'highlight',
      color: 'yellow',
      note: 'hi',
      text: 'word',
      global: true,
      createdAt: 100,
    });
    const restyled = makeNote({
      id: 'tmp',
      style: 'underline',
      color: 'red',
      note: '',
      text: 'word',
      createdAt: 200,
      updatedAt: 200,
    });
    const merged = mergeRestyledAnnotation(existing, restyled);
    expect(merged.id).toBe('a');
    expect(merged.style).toBe('underline');
    expect(merged.color).toBe('red');
    expect(merged.note).toBe('hi');
    expect(merged.global).toBe(true);
    expect(merged.createdAt).toBe(100);
    expect(merged.updatedAt).toBe(200);
  });
});

describe('removeEmptyAnnotationPlaceholder', () => {
  const baseNote = (overrides: Partial<BookNote> = {}): BookNote => ({
    id: 'ph-1',
    type: 'annotation',
    cfi: 'epubcfi(/6/4!/4/2)',
    style: 'highlight',
    color: 'yellow',
    text: 'selected text',
    note: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  });

  it('tombstones the empty placeholder by id and returns it', () => {
    const placeholder = baseNote();
    const booknotes = [placeholder];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBe(placeholder);
    expect(booknotes[0]!.deletedAt).toBe(1234);
  });

  it('returns null and leaves booknotes untouched when the record carries note text', () => {
    const saved = baseNote({ note: 'a real note' });
    const booknotes = [saved];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBeNull();
    expect(booknotes[0]!.deletedAt).toBeUndefined();
  });

  it('treats whitespace-only note text as empty and tombstones it', () => {
    const placeholder = baseNote({ note: '   \n  ' });
    const booknotes = [placeholder];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBe(placeholder);
    expect(booknotes[0]!.deletedAt).toBe(1234);
  });

  it('returns null when no record matches the id', () => {
    const booknotes = [baseNote({ id: 'other' })];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBeNull();
    expect(booknotes[0]!.deletedAt).toBeUndefined();
  });

  it('returns null when the matching record is already soft-deleted', () => {
    const booknotes = [baseNote({ deletedAt: 5 })];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBeNull();
  });

  it('ignores a non-annotation record with the same id', () => {
    const bookmark = baseNote({ type: 'bookmark', style: undefined });
    const booknotes = [bookmark];

    const removed = removeEmptyAnnotationPlaceholder(booknotes, 'ph-1', 1234);

    expect(removed).toBeNull();
    expect(booknotes[0]!.deletedAt).toBeUndefined();
  });
});
