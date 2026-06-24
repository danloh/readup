import { describe, expect, it } from 'vitest';
import {
  BookConfig,
  BookSearchConfig,
  ViewSettings,
} from '@/types/book';
import { serializeConfig } from '@/utils/serializer';

const globalViewSettings = {
  zoomLevel: 100,
  scrolled: false,
} as ViewSettings;

const defaultSearchConfig = {
  scope: 'book',
  matchCase: false,
  matchWholeWords: false,
  matchDiacritics: false,
} as BookSearchConfig;

describe('BookConfig serialization', () => {
  it('does not persist an array view setting that equals the global value', () => {
    // Array/object view settings must be compared by value, not reference —
    // otherwise annotationToolbarItems (an array) is stored as a per-book override on
    // every save, shadowing later global changes (the customize-toolbar bug).
    const global = {
      ...globalViewSettings,
      annotationToolbarItems: ['highlight', 'annotate', 'copy'],
    } as unknown as ViewSettings;
    const config: BookConfig = {
      updatedAt: 1,
      // Same content as global but a distinct array reference, as produced by the
      // load -> merge -> serialize round-trip.
      viewSettings: {
        annotationToolbarItems: ['highlight', 'annotate', 'copy'],
      } as Partial<ViewSettings>,
    };

    const parsed = JSON.parse(serializeConfig(config, global, defaultSearchConfig));

    expect(parsed.viewSettings.annotationToolbarItems).toBeUndefined();
  });

  it('persists an array view setting that differs from the global value', () => {
    const global = {
      ...globalViewSettings,
      annotationToolbarItems: ['highlight', 'annotate', 'copy'],
    } as unknown as ViewSettings;
    const config: BookConfig = {
      updatedAt: 1,
      viewSettings: { annotationToolbarItems: ['copy'] } as Partial<ViewSettings>,
    };

    const parsed = JSON.parse(serializeConfig(config, global, defaultSearchConfig));

    expect(parsed.viewSettings.annotationToolbarItems).toEqual(['copy']);
  });
});
