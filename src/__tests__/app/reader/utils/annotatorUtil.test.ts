import { describe, expect, it } from 'vitest';
import {
  decideAnnotationDraw,
  filterExportGroups,
  findAnnotationAtCfi,
  getAnnotationOverlayColor,
  mergeRestyledAnnotation,
  removeEmptyAnnotationPlaceholder,
} from '@/app/read/utils/annotatorUtil';
import { BookNote, BooknoteGroup } from '@/types/book';
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

describe('filterExportGroups', () => {
  const group = (booknotes: BookNote[], over: Partial<BooknoteGroup> = {}): BooknoteGroup => ({
    id: 0,
    href: 'h',
    label: 'Chapter',
    booknotes,
    ...over,
  });

  it('keeps everything when nothing is excluded', () => {
    const groups = [group([makeNote({ color: 'yellow' }), makeNote({ color: 'red' })])];
    const result = filterExportGroups(groups, { excludedColors: [], excludedStyles: [] });
    expect(result.groups[0]!.booknotes).toHaveLength(2);
    expect(result.applyColorFilter).toBe(true);
    expect(result.distinctColors).toEqual(['red', 'yellow']);
  });

  it('excludes a color and keeps the others', () => {
    const groups = [
      group([makeNote({ id: 'a', color: 'yellow' }), makeNote({ id: 'b', color: 'red' })]),
    ];
    const result = filterExportGroups(groups, { excludedColors: ['red'], excludedStyles: [] });
    expect(result.groups[0]!.booknotes.map((n) => n.id)).toEqual(['a']);
  });

  it('excludes a style and keeps the others', () => {
    const groups = [
      group([
        makeNote({ id: 'a', color: 'yellow', style: 'highlight' }),
        makeNote({ id: 'b', color: 'yellow', style: 'underline' }),
      ]),
    ];
    const result = filterExportGroups(groups, {
      excludedColors: [],
      excludedStyles: ['underline'],
    });
    expect(result.groups[0]!.booknotes.map((n) => n.id)).toEqual(['a']);
  });

  it('combines color and style filters with AND', () => {
    const groups = [
      group([
        makeNote({ id: 'a', color: 'yellow', style: 'highlight' }),
        makeNote({ id: 'b', color: 'red', style: 'highlight' }),
        makeNote({ id: 'c', color: 'yellow', style: 'underline' }),
      ]),
    ];
    const result = filterExportGroups(groups, {
      excludedColors: ['red'],
      excludedStyles: ['underline'],
    });
    expect(result.groups[0]!.booknotes.map((n) => n.id)).toEqual(['a']);
  });

  it('drops groups that become empty', () => {
    const groups = [
      group([makeNote({ id: 'a', color: 'red' })], { href: 'h1' }),
      group([makeNote({ id: 'b', color: 'yellow' })], { href: 'h2' }),
    ];
    const result = filterExportGroups(groups, { excludedColors: ['red'], excludedStyles: [] });
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]!.href).toBe('h2');
  });

  it('always keeps notes without a color or style (e.g. bookmarks)', () => {
    const groups = [
      group([
        makeNote({ id: 'a', color: 'yellow' }),
        makeNote({ id: 'b', color: 'red' }),
        makeNote({ id: 'bm', type: 'bookmark', color: undefined, style: undefined }),
      ]),
    ];
    const result = filterExportGroups(groups, {
      excludedColors: ['red', 'yellow'],
      excludedStyles: [],
    });
    expect(result.groups[0]!.booknotes.map((n) => n.id)).toEqual(['bm']);
  });

  it('does not apply the color filter when fewer than two colors are present', () => {
    const groups = [
      group([makeNote({ id: 'a', color: 'yellow' }), makeNote({ id: 'b', color: 'yellow' })]),
    ];
    const result = filterExportGroups(groups, { excludedColors: ['yellow'], excludedStyles: [] });
    expect(result.applyColorFilter).toBe(false);
    expect(result.groups[0]!.booknotes).toHaveLength(2);
  });

  it('orders distinct colors by default palette then custom, and styles canonically', () => {
    const groups = [
      group([
        makeNote({ color: 'yellow', style: 'squiggly' }),
        makeNote({ color: 'blue', style: 'highlight' }),
        makeNote({ color: 'red', style: 'underline' }),
      ]),
    ];
    const result = filterExportGroups(groups, { excludedColors: [], excludedStyles: [] });
    expect(result.distinctColors).toEqual(['red', 'blue', 'yellow']);
    expect(result.distinctStyles).toEqual(['highlight', 'underline', 'squiggly']);
  });
});

/**
 * B&W e-ink composites highlight overlays with `mix-blend-mode: difference` at
 * full opacity (useTheme.ts), so the fill is an inversion mask, not a paint
 * color. Difference is `|backdrop - source|`, which makes black its identity
 * element: a black mask leaves the page pixel-for-pixel unchanged and the
 * highlight simply does not exist. Masking with the theme background therefore
 * erased every highlight in dark mode, and because overlays keep the fill they
 * were drawn with, switching back to light stayed broken until reload (#5667).
 *
 * Underline and squiggly are stroked without a blend mode, so they still take
 * the theme ink.
 */
describe('getAnnotationOverlayColor', () => {
  const LIGHT_EINK = { isBwEink: true, isDarkMode: false };
  const DARK_EINK = { isBwEink: true, isDarkMode: true };
  const PAGE = [255, 255, 255];
  const INK = [0, 0, 0];

  const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  // How the compositor resolves `mix-blend-mode: difference` per channel.
  const difference = (backdrop: number[], source: number[]) =>
    backdrop.map((channel, i) => Math.abs(channel - source[i]!));

  it('masks the highlight with one theme-independent color', () => {
    expect(getAnnotationOverlayColor('highlight', '#fef08a', DARK_EINK)).toBe(
      getAnnotationOverlayColor('highlight', '#fef08a', LIGHT_EINK),
    );
  });

  it('swaps page and ink on a light e-ink page', () => {
    const mask = toRgb(getAnnotationOverlayColor('highlight', '#fef08a', LIGHT_EINK));

    expect(difference(PAGE, mask)).toEqual(INK);
    expect(difference(INK, mask)).toEqual(PAGE);
  });

  it('swaps page and ink on a dark e-ink page', () => {
    const mask = toRgb(getAnnotationOverlayColor('highlight', '#fef08a', DARK_EINK));

    // The dark page paints ink where light paints page, so the same mask has
    // to invert both. A mask of `#000000` returned the backdrop untouched.
    expect(difference(INK, mask)).toEqual(PAGE);
    expect(difference(PAGE, mask)).toEqual(INK);
  });

  it('strokes the unblended styles in the theme ink', () => {
    expect(getAnnotationOverlayColor('underline', '#fef08a', LIGHT_EINK)).toBe('#000000');
    expect(getAnnotationOverlayColor('squiggly', '#fef08a', DARK_EINK)).toBe('#ffffff');
  });

  it('passes the annotation color through off B&W e-ink', () => {
    for (const style of ['highlight', 'underline', 'squiggly'] as const) {
      expect(
        getAnnotationOverlayColor(style, '#fef08a', { isBwEink: false, isDarkMode: true }),
      ).toBe('#fef08a');
    }
  });
});
