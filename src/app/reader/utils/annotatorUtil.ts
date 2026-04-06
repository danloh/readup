import { HIGHLIGHT_COLOR_HEX } from '@/services/constants';
import { BookNote, HighlightColor } from '@/types/book';
import { SystemSettings } from '@/types/settings';
import { FoliateView, NOTE_PREFIX } from '@/types/view';
import { Point } from '@/utils/sel';

export const getHighlightColorHex = (
  settings: SystemSettings,
  color?: HighlightColor,
): string | undefined => {
  if (!color) return undefined;
  if (color.startsWith('#')) return color;
  const customColors = settings.globalReadSettings.customHighlightColors;
  return customColors?.[color] ?? HIGHLIGHT_COLOR_HEX[color];
};

export function getExternalDragHandle(
  currentStart: Point,
  currentEnd: Point,
  externalDragPoint?: Point | null,
): 'start' | 'end' | null {
  if (!externalDragPoint) return null;
  const distToStart = Math.hypot(
    externalDragPoint.x - currentStart.x,
    externalDragPoint.y - currentStart.y,
  );
  const distToEnd = Math.hypot(
    externalDragPoint.x - currentEnd.x,
    externalDragPoint.y - currentEnd.y,
  );
  return distToStart < distToEnd ? 'start' : 'end';
}

export function toParentViewportPoint(doc: Document, x: number, y: number): Point {
  const frameElement = doc.defaultView?.frameElement;
  const frameRect = frameElement?.getBoundingClientRect() ?? { top: 0, left: 0 };
  return { x: x + frameRect.left, y: y + frameRect.top };
}

/**
 * Remove any overlays drawn for a BookNote from the given view.
 *
 * A single BookNote can have up to two overlays attached:
 *   - a highlight/underline/squiggly overlay (keyed by the raw CFI)
 *   - a note bubble overlay (keyed by `${NOTE_PREFIX}${cfi}`)
 *
 * The set of overlays drawn is defined by the progress-sync effect in
 * Annotator.tsx, and this helper mirrors those filters so that deleting
 * an annotation from the sidebar clears every overlay that was drawn
 * for it, not just the note bubble.
 */
export function removeBookNoteOverlays(view: FoliateView | null, note: BookNote): void {
  if (!view) return;
  if (note.type !== 'annotation') return;
  if (note.style) {
    view.addAnnotation({ ...note, value: note.cfi }, true);
  }
  if (note.note && note.note.trim().length > 0) {
    view.addAnnotation({ ...note, value: `${NOTE_PREFIX}${note.cfi}` }, true);
  }
}