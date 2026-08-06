import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { TbHighlightOff } from "react-icons/tb";
import * as CFI from 'foliate-js/epubcfi.js';
import { Overlayer } from 'foliate-js/overlayer.js';

import { useEnv } from '@/context/EnvContext';
import { BookNote, BooknoteGroup, HighlightColor, HighlightStyle } from '@/types/book';
import { FoliateView, NOTE_PREFIX } from '@/types/view';
import { NativeTouchEventType } from '@/types/system';
import { Insets } from '@/types/misc';
import { getOSPlatform, makeSafeFilename, uniqueId } from '@/utils/misc';
import { invokeSystemDictionary } from '@/services/dictionaries/systemDictionary';
import { isSystemDictionaryEnabled } from '@/services/dictionaries/registry';
import { useCustomDictionaryStore } from '@/store/customDictionaryStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookProgress } from '@/store/readerProgressStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import useShortcuts from '@/hooks/useShortcuts';
import { 
  getPopupPosition, 
  getPosition, 
  getRangeRectInWebview, 
  getRangeTextStyleInWebview, 
  getTextFromRange, 
  Point, 
  Position, 
  TextSelection 
} from '@/utils/sel';
import { eventDispatcher } from '@/utils/event';
import { findTocItemBS } from '@/services/nav';
import { throttle } from '@/utils/throttle';
import { getWordCount, isSingleLookupTerm } from '@/utils/word';
import { writeTextToClipboard } from '@/utils/clipboard';
import { getIndexFromCfi } from '@/utils/cfi';
import { useFoliateEvents } from '../../hooks/useFoliateEvents';
import { useTextSelector } from '../../hooks/useTextSelector';
import { decideAnnotationDraw, getHighlightColorHex, mergeRestyledAnnotation } from '../../utils/annotatorUtil';
import { 
  beginGesture,
  createDeferredActionState, 
  flushDeferredAction, 
  isLongPressHold, 
  runOrDeferAction 
} from '../../utils/deferredAction';
import { TransformContext } from '../../transformers/types';
import { transformContent } from '../../transformers/transformService';
import { 
  expandAllRenderedSections, 
  expandGlobalAnnotation, 
  isSyntheticGlobalValue, 
  removeGlobalAnnotationOverlays, 
  sourceCfiFromSyntheticValue 
} from '../../utils/globalAnnotations';
import { setProofreadRulesVisibility } from '../ProofreadRules';
import { annotationToolButtons } from './AnnotationTools';
import AnnotationPopup from './AnnotationPopup';
import DictionaryPopup from './DictionaryPopup';
import WikipediaPopup from './WikipediaPopup';
import TranslatorPopup from './TranslatorPopup';
import ProofreadPopup from './ProofreadPopup';
import AnnotationRangeEditor from './AnnotationRangeEditor';
import ExportMarkdownDialog from './ExportMarkdownDialog';
import ExcerptDialog from './ExcerptDialog';
import DictionarySheet from './DictionarySheet';
import SelectionRangeEditor from './SelectionRangeEditor';
import { buildAnnotationIndex, selectLocationAnnotations } from '../../utils/annotationIndex';
import { useRendererInputListeners } from '../../hooks/useRendererInputListeners';

const Annotator: React.FC<{ bookKey: string; contentInsets: Insets }> = ({
  bookKey,
  contentInsets,
}) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { 
    settings, setSettingsDialogBookKey, setFontLayoutSettingsDialogOpen, setActiveSettingsItemId 
  } = useSettingsStore();
  const { isDarkMode } = useThemeStore();
  const { getConfig, saveConfig, getBookData, updateBooknotes } = useBookDataStore();
  const { getView, getViewsById, getViewSettings } = useReaderStore();
  const { setNotebookVisible, setNotebookNewAnnotation, setNotebookNewHighlightId } =
    useNotebookStore();
  const { listenToNativeTouchEvents } = useDeviceControlStore();

  const osPlatform = getOSPlatform();
  const config = getConfig(bookKey)!;
  // Reactive: subscribe to THIS book's progress via the dedicated
  // progress store. This is the only piece of data we need to react to
  // per page turn — the `useEffect(..., [progress])` below uses it to
  // re-apply local-page annotations after each relocate.
  const progress = useBookProgress(bookKey)!;
  const bookData = getBookData(bookKey)!;
  const view = getView(bookKey);
  const viewSettings = getViewSettings(bookKey)!;
  const primaryLang = bookData.book?.primaryLanguage || 'en';

  const containerRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [showAnnotPopup, setShowAnnotPopup] = useState(false);
  const [showDictPopup, setShowDictPopup] = useState(false);
  const [showWikipediaPopup, setShowWikipediaPopup] = useState(false);
  const [showTsPopup, setShowTsPopup] = useState(false);
  const [trianglePosition, setTrianglePosition] = useState<Position>();
  const [annotPopupPosition, setAnnotPopupPosition] = useState<Position>();
  const [dictPopupPosition, setDictPopupPosition] = useState<Position>();
  const [translatorPopupPosition, setTranslatorPopupPosition] = useState<Position>();
  const [proofreadPopupPosition, setProofreadPopupPosition] = useState<Position>();
  const [highlightOptionsVisible, setHighlightOptionsVisible] = useState(false);
  const [showProofreadPopup, setShowProofreadPopup] = useState(false);
  const [showAnnotationNotes, setShowAnnotationNotes] = useState(false);
  const [annotationNotes, setAnnotationNotes] = useState<BookNote[]>([]);
  const [editingAnnotation, setEditingAnnotation] = useState<BookNote | null>(null);
  const [externalDragPoint, setExternalDragPoint] = useState<Point | null>(null);
  const [showExcerptDialog, setShowExcerptDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportData, setExportData] = useState<{
    booknoteGroups: { [href: string]: BooknoteGroup };
  } | null>(null);

  const [selectedStyle, setSelectedStyle] = useState<HighlightStyle>(
    settings.globalReadSettings.highlightStyle,
  );
  const [selectedColor, setSelectedColor] = useState<HighlightColor>(
    settings.globalReadSettings.highlightStyles[selectedStyle],
  );

  const androidTouchEndRef = useRef(false);
  // Holds a quick action that fired while the user is still touching the screen
  // (Android long-press selects text via selectionchange before touchend). The
  // pending action runs on touchend so popups don't open under an active touch.
  const deferredQuickActionRef = useRef(createDeferredActionState());
  // Timestamp of the latest touch pointerdown (0 for mouse). Used to require a
  // long-press hold before the instant quick action fires, so a tap-to-deselect
  // can't re-open the dictionary off a racy lingering selectionchange (iOS).
  const pointerDownTimeRef = useRef(0);

  const showingPopup =
    showAnnotPopup ||
    showDictPopup ||
    showWikipediaPopup ||
    showTsPopup ||
    showProofreadPopup;

  const popupPadding = useResponsiveSize(10);
  const trianglePadding = popupPadding * 2 + 6;
  const maxWidth = window.innerWidth - 2 * popupPadding;
  const maxHeight = window.innerHeight - 2 * popupPadding;
  // Tall enough to fit a header + 2-3 expanded cards comfortably. The popup
  // shows all enabled providers stacked (no tabs) so it needs more vertical
  // room than the legacy single-tab layout.
  const dictPopupHeight = Math.min(360, maxHeight);
  const dictPopupWidth = Math.min(480, maxWidth);
  const transPopupWidth = Math.min(480, maxWidth);
  const transPopupHeight = Math.min(265, maxHeight);
  const proofreadPopupWidth = Math.min(440, maxWidth);
  const proofreadPopupHeight = Math.min(200, maxHeight);
  const annotPopupWidth = Math.min(useResponsiveSize(350), maxWidth);
  const annotPopupHeight = useResponsiveSize(44);
  const androidSelectionHandlerHeight = 0;

  // Reposition popups on scroll without dismissing them
  const repositionPopups = useCallback(() => {
    if (!selection || !selection.text) return;
    const gridFrame = document.querySelector(`#gridcell-${bookKey}`);
    if (!gridFrame) return;
    const rect = gridFrame.getBoundingClientRect();
    const triangPos = getPosition(selection, rect, trianglePadding, viewSettings.vertical);
    const annotPopupPos = getPopupPosition(
      triangPos,
      rect,
      viewSettings.vertical ? annotPopupHeight : annotPopupWidth,
      viewSettings.vertical ? annotPopupWidth : annotPopupHeight,
      popupPadding,
    );
    if (annotPopupPos.dir === 'down' && osPlatform === 'android') {
      triangPos.point.y += androidSelectionHandlerHeight;
      annotPopupPos.point.y += androidSelectionHandlerHeight;
    }
    const dictPopupPos = getPopupPosition(
      triangPos,
      rect,
      dictPopupWidth,
      dictPopupHeight,
      popupPadding,
    );
    const transPopupPos = getPopupPosition(
      triangPos,
      rect,
      transPopupWidth,
      transPopupHeight,
      popupPadding,
    );
    const proofreadPopupPos = getPopupPosition(
      triangPos,
      rect,
      proofreadPopupWidth,
      proofreadPopupHeight,
      popupPadding,
    );
    if (triangPos.point.x == 0 || triangPos.point.y == 0) return;
    setAnnotPopupPosition(annotPopupPos);
    setDictPopupPosition(dictPopupPos);
    setTranslatorPopupPosition(transPopupPos);
    setProofreadPopupPosition(proofreadPopupPos);
    setTrianglePosition(triangPos);
  }, [selection, bookKey, viewSettings.vertical]);

  useEffect(() => {
    const highlightStyle = settings.globalReadSettings.highlightStyle;
    setSelectedStyle(highlightStyle);
    setSelectedColor(settings.globalReadSettings.highlightStyles[highlightStyle]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.globalReadSettings.highlightStyle]);

  const transformCtx: TransformContext = useMemo(
    () => ({
      bookKey,
      viewSettings: getViewSettings(bookKey)!,
      isFixedLayout: bookData.isFixedLayout,
      // userLocale: getLocale(),
      content: '',
      transformers: ['punctuation'],
      reversePunctuationTransform: true,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const getAnnotationText = useCallback(
    async (range: Range) => {
      transformCtx['content'] = getTextFromRange(range, ['rt']);
      return await transformContent(transformCtx);
    },
    [primaryLang, transformCtx],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDismissPopup = useCallback(
    throttle(() => {
      setSelection(null);
      setShowAnnotPopup(false);
      setShowDictPopup(false);
      setShowWikipediaPopup(false);
      setShowTsPopup(false);
      setShowProofreadPopup(false);
      setEditingAnnotation(null);
    }, 500),
    [],
  );

  const {
    isTextSelected,
    isInstantAnnotating,
    handleScroll,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handlePointerDown,
    handlePointerMove,
    handleNativeTouchMove,
    handlePointerCancel,
    handlePointerUp,
    handleSelectionchange,
    handleShowPopup,
    handleUpToPopup,
    handleContextmenu,
    applyProgrammaticSelection,
    noteAutoTurnPoint,
    cancelAutoTurn,
    onAutoTurn,
  } = useTextSelector(
    bookKey,
    contentInsets,
    setSelection,
    setEditingAnnotation,
    setExternalDragPoint,
    getAnnotationText,
    handleDismissPopup,
  );

  const handleDismissPopupAndSelection = () => {
    handleDismissPopup();
    view?.deselect();
    isTextSelected.current = false;
  };

  const onLoad = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { doc, index } = detail;

    const handleTouchmove = (ev: TouchEvent) => {
      // Available on iOS, on Android not fired
      // To make the popup not follow the selection while dragging
      setShowAnnotPopup(false);
      if (!isInstantAnnotating.current) {
        setEditingAnnotation(null);
      }
      handleTouchMove(ev);
    };

    // Attach generic selection listeners for all formats, including PDF.
    // For PDF we only guarantee Copy & Translate; highlight/annotate may be limited by CFI support.
    //
    // The renderer `scroll` listener and the Android `native-touch` bridge are
    // NOT attached here: onLoad fires for every (pre)loaded section, but those
    // listeners live on the renderer / global dispatcher, which outlive sections.
    // Attaching them per load leaked one set per chapter and degraded paragraph
    // mode over a long session. They are registered once per view via
    // useRendererInputListeners below. Popup repositioning on scroll is already
    // handled by the dedicated effect further down.
    const opts = { passive: false };
    detail.doc?.addEventListener('touchstart', handleTouchStart, opts);
    detail.doc?.addEventListener('touchmove', handleTouchmove, opts);
    detail.doc?.addEventListener('touchend', handleTouchEnd);
    // Re-arm the instant quick action at the start of each gesture. Android does
    // this via the native-touch touchstart above; iOS/desktop have no such path,
    // and a single iOS long-press emits multiple selectionchange events for the
    // same word — without re-arming, the system-dictionary sheet stacked twice
    // (the action fired once per event instead of once per gesture).
    if (!appService?.isAndroidApp) {
      detail.doc?.addEventListener(
        'pointerdown',
        (ev: Event) => {
          beginGesture(deferredQuickActionRef.current);
          // Remember when the gesture started so the instant quick action can
          // require a long-press hold (touch only — mouse selections fire on
          // pointerup and shouldn't be time-gated).
          pointerDownTimeRef.current =
            (ev as PointerEvent).pointerType === 'mouse' ? 0 : Date.now();
        },
        opts,
      );
    }
    detail.doc?.addEventListener('pointerdown', handlePointerDown.bind(null, doc, index), opts);
    detail.doc?.addEventListener('pointermove', handlePointerMove.bind(null, doc, index), opts);
    detail.doc?.addEventListener('pointercancel', handlePointerCancel.bind(null, doc, index));
    detail.doc?.addEventListener('pointerup', handlePointerUp.bind(null, doc, index));
    detail.doc?.addEventListener('selectionchange', handleSelectionchange.bind(null, doc, index));

    // For PDF selections, enable right-click context menu to directly open translator popup.
    if (bookData.isFixedLayout) {
      detail.doc?.addEventListener('contextmenu', (e: Event) => {
        try {
          const sel = doc.getSelection?.();
          if (sel && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            const text = sel.toString();
            if (text.trim()) {
              setSelection({
                key: bookKey,
                text,
                range,
                index,
                cfi: view?.getCFI(index, range),
                page: index + 1,
              });
              // Show translation popup preferentially for PDF right-click
              setShowAnnotPopup(false);
              setShowTsPopup(true);
              setShowDictPopup(false);
              setShowWikipediaPopup(false);
            }
          }
        } catch (err) {
          console.warn('PDF context menu translation failed:', err);
        }
        // Prevent native menu to keep experience consistent
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    }

    // Disable the default context menu on mobile devices (selection handles suffice)
    detail.doc?.addEventListener('contextmenu', handleContextmenu);
  };

  const onCreateOverlay = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { booknotes = [] } = getConfig(bookKey)!;
    // Resolve the live (doc, overlayer) pair for this section so we can
    // fan out global annotations across every text-occurrence in it.
    const sectionContent = view?.renderer?.getContents().find((c) => c.index === detail.index) as
      | { doc?: Document; index?: number }
      | undefined;
    const sectionDoc = sectionContent?.doc;

    const activeAnnotations = booknotes.filter((b) => b.type === 'annotation' && !b.deletedAt);

    // 1. Draw native overlays only for notes whose anchor (cfi) lives
    //    inside this section — same as before.
    activeAnnotations
      .filter((booknote) => getIndexFromCfi(booknote.cfi) === detail.index)
      .map((annotation) => {
        try {
          view?.addAnnotation(annotation);
        } catch (err) {
          console.warn('Failed to add annotation', { annotation, error: err });
        }
      });

    // 2. Fan out every `global` annotation in this newly-rendered
    //    section, regardless of which section originally anchored it.
    //    `expandGlobalAnnotation` already skips the home anchor when the
    //    synthetic CFI collides with `note.cfi`.
    if (sectionDoc) {
      for (const annotation of activeAnnotations) {
        if (!annotation.global) continue;
        try {
          expandGlobalAnnotation(view ?? null, annotation, sectionDoc, detail.index);
        } catch (err) {
          console.warn('Failed to expand global annotation', { annotation, error: err });
        }
      }
    }
  };

  const onDrawAnnotation = (event: Event) => {
    const viewSettings = getViewSettings(bookKey)!;
    const isBwEink = viewSettings.isEink && !viewSettings.isColorEink;
    const detail = (event as CustomEvent).detail;
    const { draw, annotation, doc, range } = detail;
    const { style, color } = annotation as BookNote;
    const value = (annotation as BookNote & { value?: string }).value;
    const hexColor = getHighlightColorHex(settings, color);
    const einkBgColor = isDarkMode ? '#000000' : '#ffffff';
    const einkFgColor = isDarkMode ? '#ffffff' : '#000000';
      
    // Choose what to draw from the overlay's `value` (cfi vs NOTE_PREFIX+cfi),
    // not from `annotation.note`: a unified record (style + note) is added as
    // two overlays and must draw a highlight for the cfi overlay AND a bubble
    // for the note overlay. Keying off `note` drew only the bubble (#4511).
    const kind = decideAnnotationDraw(value, style);
    if (kind === 'bubble') {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode } = defaultView.getComputedStyle(el);
      draw(Overlayer.bubble, { writingMode });
    } else if (kind === 'highlight') {
      draw(Overlayer.highlight, {
        color: isBwEink ? einkBgColor : hexColor,
        vertical: viewSettings.vertical,
      });
    } else if (['underline', 'squiggly'].includes(kind as string)) {
      const { defaultView } = doc;
      const node = range.startContainer;
      const el = node.nodeType === 1 ? node : node.parentElement;
      const { writingMode, lineHeight, fontSize } = defaultView.getComputedStyle(el);
      const fontSizeValue = parseFloat(fontSize) || viewSettings.defaultFontSize;
      const lineHeightValue = parseFloat(lineHeight) || viewSettings.lineHeight * fontSizeValue;
      const strokeWidth = 2;
      const verticalCompensation = appService?.isMobile ? 0 : -1;
      const horizontalCompensation = appService?.isMobile ? -1 : 0;
      const padding = viewSettings.vertical
        ? (lineHeightValue - fontSizeValue) / 2 - strokeWidth + verticalCompensation
        : (lineHeightValue - fontSizeValue) / 2 - strokeWidth + horizontalCompensation;
      draw(Overlayer[kind as keyof typeof Overlayer], {
        writingMode,
        color: isBwEink ? einkFgColor : hexColor,
        padding,
      });
    }
  };

  const onShowAnnotation = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    const { value, index, range } = detail;
    const { booknotes = [] } = getConfig(bookKey)!;
    const isNote = value.startsWith(NOTE_PREFIX);
    const rawValue = isNote ? value.replace(NOTE_PREFIX, '') : value;
    // A click on a fan-out copy of a global annotation reports a
    // synthetic value (`${cfi}#g${i}`); map it back to the source
    // booknote so the popup behaves identically to clicking the
    // original anchor.
    const cfi = isSyntheticGlobalValue(rawValue) 
      ? sourceCfiFromSyntheticValue(rawValue) 
      : rawValue;
    const annotations = booknotes.filter(
      (booknote) => booknote.type === 'annotation' && !booknote.deletedAt && booknote.cfi === cfi,
    );
    const annotation = annotations.find(
      (annotation) => (!isNote && annotation.style) || (isNote && annotation.note),
    );
    if (!annotation) return;

    const { style, color, text, note } = annotation;
    const selection = {
      key: bookKey,
      annotated: true,
      text: text ?? '',
      note: note ?? '',
      rect: isNote ? detail.rect : undefined,
      cfi,
      page: annotation.page || progress.page,
      range,
      index,
    };
    if (isNote) {
      setShowAnnotationNotes(true);
      setHighlightOptionsVisible(false);
      setEditingAnnotation(null);
    } else {
      setShowAnnotPopup(false);
      setEditingAnnotation(null);
      setShowAnnotationNotes(false);
      setAnnotationNotes([]);
      if (style && color) {
        setSelectedStyle(style);
        setSelectedColor(color);
      }
      if (style && range) {
        setEditingAnnotation(annotation);
      }
    }
    setSelection(selection);
    handleUpToPopup();
  };

  useFoliateEvents(view, { onLoad, onCreateOverlay, onDrawAnnotation, onShowAnnotation });

  // Android native-touch handler (the per-gesture engagement signal bridged from
  // MainActivity.kt). Registered once per view by useRendererInputListeners; it
  // resolves the CURRENT primary section's doc/index at fire time rather than
  // capturing them at load time, because foliate also fires `load` for preloaded
  // neighbour sections, whose doc/index would be off-screen.
  const handleNativeTouch = (ev: NativeTouchEventType) => {
    const contents = view?.renderer?.getContents?.() ?? [];
    const content = contents.find((c) => c.index === view?.renderer?.primaryIndex) ?? contents[0];
    const doc = content?.doc;
    const index = content?.index;
    if (!doc || index === undefined) return;
    if (ev.type === 'touchstart') {
      androidTouchEndRef.current = false;
      beginGesture(deferredQuickActionRef.current);
      handleTouchStart();
    } else if (ev.type === 'touchmove') {
      handleNativeTouchMove(ev.x, ev.y, doc);
    } else if (ev.type === 'touchend') {
      androidTouchEndRef.current = true;
      handleTouchEnd();
      handlePointerUp(doc, index);
      flushDeferredAction(deferredQuickActionRef.current);
    }
  };

  // Register the renderer `scroll` listener and (on Android) the `native-touch`
  // bridge once per view, with cleanup — see the hook for why attaching these in
  // onLoad leaked listeners and degraded paragraph mode over a long session.
  useRendererInputListeners(view, {
    onRendererScroll: handleScroll,
    onNativeTouch: handleNativeTouch,
    enableNativeTouch: !!appService?.isAndroidApp,
    listenToNativeTouchEvents,
  });

  useEffect(() => {
    handleShowPopup(showingPopup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingPopup]);

  // When popups are visible, update their positions on scroll events
  useEffect(() => {
    const view = getView(bookKey);
    if (!view?.renderer) return;
    const onScroll = () => {
      if (showingPopup) {
        repositionPopups();
      }
    };
    view.renderer.addEventListener('scroll', onScroll);
    return () => {
      view.renderer.removeEventListener('scroll', onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookKey, showingPopup, repositionPopups]);

  useEffect(() => {
    eventDispatcher.on('export-annotations', handleExportMarkdown);
    return () => {
      eventDispatcher.off('export-annotations', handleExportMarkdown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Lazily back-fill `page` on every annotation that doesn't have one
    // yet. Each call to view.getCFIProgress(cfi) synchronously
    // decompresses the matching section's XHTML out of the EPUB zip and
    // walks its text nodes (foliate-js progress.js #getCache), costing
    // ~100-300ms per cold section on a release Android build. For users
    // with many annotations spread across many chapters that's seconds
    // of zip-IPC + main-thread work and the back-fill must NOT steal
    // the open-book hot window. The `page` field only feeds the
    // secondary "p NN ·" label in the sidebar BooknoteItem — strictly a
    // nice-to-have.
    //
    // First attempt used requestIdleCallback. On Android Tauri the
    // WebView's rIC fires aggressively while the main thread is still
    // doing layout/style work for the freshly-opened book, so each tick
    // ended up running a 100-300ms getCFIProgress in what was
    // effectively the hot window — Bottom-Up profile showed 1.5s+ of
    // sendIpcMessage -> readData -> loadDocument -> getCFIProgress under
    // "Fire Idle Callback" still inside the open-book TBT window.
    //
    // Strategy now:
    //  - Hard gate on the FIRST 'stabilized' renderer event (i.e. wait
    //    until the open-book paint is fully settled).
    //  - Then a 5s grace timer so the user's first page-turns and the
    //    paginator's adjacent-section preload can finish.
    //  - Then process annotations one-at-a-time with a 250ms gap
    //    between each. Each getCFIProgress shows up as its own short
    //    task with input-handling slots in between, instead of a chain
    //    of back-to-back idle callbacks.
    //  - Batch the saveConfig write at the end (one IPC instead of N).
    //  - Skip entirely if there are no annotations missing a page.
    const config = getConfig(bookKey);
    const allAnnotations = config?.booknotes ?? [];
    const pending = allAnnotations.filter((a) => !a.deletedAt && a.cfi && !a.page);
    if (pending.length === 0) return;
    pending.sort((a, b) => CFI.compare(a.cfi, b.cfi));

    const GRACE_MS = 5000;
    const TICK_GAP_MS = 250;

    let cancelled = false;
    let scheduledHandle: ReturnType<typeof setTimeout> | null = null;
    let pendingStabilizedView: FoliateView | null = null;
    let pendingStabilizedHandler: (() => void) | null = null;

    const detachStabilized = () => {
      if (pendingStabilizedView && pendingStabilizedHandler) {
        try {
          pendingStabilizedView.renderer?.removeEventListener(
            'stabilized',
            pendingStabilizedHandler,
          );
        } catch {
          // ignore — renderer may be torn down already.
        }
      }
      pendingStabilizedView = null;
      pendingStabilizedHandler = null;
    };

    let touched = false;
    let i = 0;
    const tick = async () => {
      if (cancelled) return;
      scheduledHandle = null;
      const view = getView(bookKey);
      if (!view) {
        // View not ready yet — back off and try again.
        scheduledHandle = setTimeout(tick, TICK_GAP_MS);
        return;
      }
      const annotation = pending[i++];
      if (annotation && !annotation.page) {
        try {
          const progress = await view.getCFIProgress(annotation.cfi);
          if (!cancelled && progress) {
            annotation.page = progress.location.current + 1;
            touched = true;
          }
        } catch (err) {
          console.warn('Failed to back-fill annotation page', err);
        }
      }
      if (cancelled) return;
      if (i < pending.length) {
        scheduledHandle = setTimeout(tick, TICK_GAP_MS);
      } else if (touched) {
        const updatedConfig = updateBooknotes(bookKey, allAnnotations);
        if (updatedConfig) {
          saveConfig(envConfig, bookKey, updatedConfig, settings);
        }
      }
    };

    const startGrace = () => {
      if (cancelled) return;
      scheduledHandle = setTimeout(tick, GRACE_MS);
    };

    // Wait for the renderer to fire its first 'stabilized' event before
    // arming the grace timer. If the renderer is missing (e.g. fixed-
    // layout PDF teardown path) or never stabilizes within 10s, fall
    // back to a plain time-based start so the page back-fill still
    // eventually runs.
    const view = getView(bookKey);
    const renderer = view?.renderer;
    const FALLBACK_START_MS = 10000;
    if (renderer && typeof renderer.addEventListener === 'function') {
      const onStabilized = () => {
        if (cancelled) return;
        detachStabilized();
        startGrace();
      };
      pendingStabilizedView = view!;
      pendingStabilizedHandler = onStabilized;
      renderer.addEventListener('stabilized', onStabilized, {
        once: true,
      } as AddEventListenerOptions);
      // Safety net: if 'stabilized' never arrives (corner cases like
      // an empty renderer) start the grace timer anyway after 10s.
      scheduledHandle = setTimeout(() => {
        if (cancelled) return;
        detachStabilized();
        startGrace();
      }, FALLBACK_START_MS);
    } else {
      scheduledHandle = setTimeout(tick, GRACE_MS);
    }

    return () => {
      cancelled = true;
      detachStabilized();
      if (scheduledHandle != null) {
        clearTimeout(scheduledHandle);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A real touch selection only appears after the OS long-press (~500ms); a
  // quick tap that re-reports a lingering selection fires far sooner.
  const quickActionMinHoldMs = 300;

  const handleQuickAction = () => {
    // iOS/desktop immediate path: only fire from a long-press hold. Without this
    // a tap-to-deselect after dismissing the system dictionary occasionally
    // re-opened it off a racy lingering selectionchange. Android defers to
    // touchend (a deliberate lift) and is left as-is.
    if (
      !appService?.isAndroidApp &&
      !isLongPressHold(pointerDownTimeRef.current, Date.now(), quickActionMinHoldMs)
    ) {
      return;
    }
    
    const action = viewSettings.annotationQuickAction;
    const runAction = () => {
      switch (action) {
        case 'copy':
          handleCopy(false);
          handleDismissPopupAndSelection();
          break;
        case 'highlight':
          // highlight is already applied in instant annotating
          handleDismissPopupAndSelection();
          break;
        case 'search':
          handleSearch();
          break;
        case 'dictionary':
          // A dictionary lookup only makes sense for a single word (or a short
          // CJK term); on a longer selection fall back to the annotation
          // toolbar so highlighting and copying stay reachable (#5213).
          if (selection && isSingleLookupTerm(selection.text)) {
            handleDictionary();
          } else {
            handleShowAnnotPopup();
          }
          break;
        case 'wikipedia':
          if (selection && isSingleLookupTerm(selection.text)) {
            handleWikipedia();
          } else {
            handleShowAnnotPopup();
          }
          break;
        case 'translate':
          handleTranslation();
          break;
        case 'tts':
          handleSpeakText(true);
          break;
      }
    };
    // On Android, a long-press fires selectionchange (and this handler) while
    // the finger is still down. Defer until touchend so popups aren't dismissed
    // by the in-progress touch (closes #3935).
    runOrDeferAction(
      deferredQuickActionRef.current,
      !!appService?.isAndroidApp && !androidTouchEndRef.current,
      runAction,
    );
  };

  useEffect(() => {
    setHighlightOptionsVisible(!!(selection && selection.annotated));
    if (selection && selection.text.trim().length > 0) {
      const gridFrame = document.querySelector(`#gridcell-${bookKey}`);
      if (!gridFrame) return;
      const rect = gridFrame.getBoundingClientRect();
      const triangPos = getPosition(selection, rect, trianglePadding, viewSettings.vertical);
      // console.log('>> selection position: ', triangPos);
      const annotPopupPos = getPopupPosition(
        triangPos,
        rect,
        viewSettings.vertical ? annotPopupHeight : annotPopupWidth,
        viewSettings.vertical ? annotPopupWidth : annotPopupHeight,
        popupPadding,
      );
      if (annotPopupPos.dir === 'down' && osPlatform === 'android') {
        triangPos.point.y += androidSelectionHandlerHeight;
        annotPopupPos.point.y += androidSelectionHandlerHeight;
      }
      const dictPopupPos = getPopupPosition(
        triangPos,
        rect,
        dictPopupWidth,
        dictPopupHeight,
        popupPadding,
      );
      const transPopupPos = getPopupPosition(
        triangPos,
        rect,
        transPopupWidth,
        transPopupHeight,
        popupPadding,
      );
      const proofreadPopupPos = getPopupPosition(
        triangPos,
        rect,
        proofreadPopupWidth,
        proofreadPopupHeight,
        popupPadding,
      );
      if (triangPos.point.x == 0 || triangPos.point.y == 0) return;
      setAnnotPopupPosition(annotPopupPos);
      setDictPopupPosition(dictPopupPos);
      setTranslatorPopupPosition(transPopupPos);
      setProofreadPopupPosition(proofreadPopupPos);
      setTrianglePosition(triangPos);
      handleShowAnnotPopup();

      const { enableAnnotationQuickActions, annotationQuickAction } = viewSettings;
      if (enableAnnotationQuickActions && annotationQuickAction && isTextSelected.current) {
        handleQuickAction();
      } else {
        handleShowAnnotPopup();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, bookKey]);

  // Index live annotations by the CFI spine prefix (the chapter id) so
  // each page turn only scans the bucket for the current chapter rather
  // than the whole booknotes array. With heavy users (>1k highlights) a
  // naive `booknotes.filter(...)` per page turn was the dominant
  // contributor to `c` (epubcfi parse) in the Bottom-Up profile —
  // ~1.4 s self time over a 28 s session. The bucketed read replaces
  // O(N) walks with O(K) where K is the number of annotations in the
  // currently-visible chapter (typically a handful).
  //
  // `globals` (book-wide highlights) are split into their own pre-filtered
  // array so we don't re-walk N items each turn just to find the same few
  // global ones. The index is recomputed only when `booknotes` itself
  // changes (add/remove/edit) — not on every page turn.
  const annotationIndex = useMemo(
    () => buildAnnotationIndex(config.booknotes ?? []),
    [config.booknotes],
  );

  useEffect(() => {
    if (!progress) return;
    const { location } = progress;
    // Single pass over the *current chapter's* candidates: classify each
    // one into the in-page annotations / notes lists. Using the bucket
    // keeps this fast even when the user has thousands of highlights
    // elsewhere in the book.
    const { annotations, notes } = selectLocationAnnotations(annotationIndex, location);

    try {
      Promise.all(annotations.map((annotation) => view?.addAnnotation(annotation)));
      Promise.all(
        notes.map((note) => view?.addAnnotation({ ...note, value: `${NOTE_PREFIX}${note.cfi}` })),
      );
      // Fan-out for any annotation flagged `global`. Semantics is
      // book-wide, so we don't filter by `location` here: every note
      // with `global=true` gets expanded across every section that
      // happens to be rendered right now. Sections rendered later are
      // covered by `onCreateOverlay`. Using the pre-built `globals`
      // array avoids re-walking booknotes per page turn.
      for (const annotation of annotationIndex.globals) {
        // Same stale-index guard as selectLocationAnnotations: a global deleted
        // in place after the memoized index was built must not be re-fanned out
        // across sections, which would orphan its overlays (#4773).
        if (annotation.deletedAt) continue;
        if (view) expandAllRenderedSections(view, annotation);
      }
    } catch (e) {
      console.warn(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, annotationIndex]);

  useEffect(() => {
    if (!config.booknotes || !selection?.cfi || !showAnnotationNotes) return;
    const annotations = config.booknotes.filter(
      (booknote) =>
        booknote.type === 'annotation' && !booknote.deletedAt && booknote.cfi === selection.cfi,
    );
    const notes = annotations.filter((item) => item.note && item.note.trim().length > 0);
    setAnnotationNotes(notes);
  }, [selection?.cfi, showAnnotationNotes, config.booknotes]);

  const handleShowAnnotPopup = () => {
    if (!appService?.isMobile) {
      containerRef.current?.focus();
    }
    setShowAnnotPopup(true);
    setShowTsPopup(false);
    setShowDictPopup(false);
    setShowWikipediaPopup(false);
    setShowProofreadPopup(false);
  };

  const handleCopy = (dismissPopup = true) => {
    if (!selection || !selection.text) return;

    setTimeout(() => {
      // Delay to ensure it won't be overridden by system clipboard actions
      void writeTextToClipboard(selection.text);
    }, 100);

    if (dismissPopup) {
      handleDismissPopupAndSelection();
    }

    if (!viewSettings?.copyToNotebook) return;

    eventDispatcher.dispatch('toast', {
      type: 'info',
      message: _('Copied to notebook'),
      className: 'whitespace-nowrap',
      timeout: 2000,
    });

    const { booknotes: annotations = [] } = config;
    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return;
    const annotation: BookNote = {
      id: uniqueId(),
      type: 'excerpt',
      cfi,
      text: selection.text,
      note: '',
      page: selection.page,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const existingIndex = annotations.findIndex(
      (annotation) =>
        annotation.cfi === cfi && annotation.type === 'excerpt' && !annotation.deletedAt,
    );
    if (existingIndex !== -1) {
      annotations[existingIndex] = annotation;
    } else {
      annotations.push(annotation);
    }
    const updatedConfig = updateBooknotes(bookKey, annotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }
    if (!appService?.isMobile) {
      setNotebookVisible(true);
    }
  };

  const handleHighlight = (update = false, highlightStyle?: HighlightStyle): BookNote | null => {
    // console.log("click highlight", update);
    if (!selection || !selection.text) return null;
    setHighlightOptionsVisible(true);
    const { booknotes: annotations = [] } = config;
    const cfi = view?.getCFI(selection.index, selection.range);
    if (!cfi) return null;
    const style = highlightStyle || settings.globalReadSettings.highlightStyle;
    const color = settings.globalReadSettings.highlightStyles[style];
    setSelectedStyle(style);
    setSelectedColor(color);
    const annotation: BookNote = {
      id: uniqueId(),
      type: 'annotation',
      cfi,
      style,
      color,
      text: selection.text,
      note: '',
      page: progress.page,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    // Only a brand-new highlight is a placeholder the cancel flow may remove;
    // restyling/toggling an existing one must never tear down the user's record.
    let created: BookNote | null = null;
    const existingIndex = annotations.findIndex(
      (annotation) =>
        annotation.cfi === cfi &&
        annotation.type === 'annotation' &&
        annotation.style &&
        !annotation.deletedAt,
    );
    const views = getViewsById(bookKey.split('-')[0]!);
    if (existingIndex !== -1) {
      const existing = annotations[existingIndex]!;
      // Tear down both the original anchor and any global fan-outs that
      // were drawn for the previous style/color, so the redraw below
      // doesn't end up overlaying two highlights at the same position.
      views.forEach((view) => view?.addAnnotation(existing, true));
      if (existing.global) {
        views.forEach((view) => removeGlobalAnnotationOverlays(view, existing));
      }
      if (update) {
        // Preserve the note/text/createdAt and the `global` flag of the existing
        // record so a restyle (color/style change) of a unified annotation
        // doesn't wipe its note or silently demote a global highlight. The note
        // bubble overlay (NOTE_PREFIX) isn't torn down above, so it persists; we
        // only redraw the highlight overlay (value = cfi).
        const merged = mergeRestyledAnnotation(existing, annotation);
        annotations[existingIndex] = merged;
        views.forEach((view) => view?.addAnnotation(merged));
        if (merged.global) {
          views.forEach((view) => {
            if (view) expandAllRenderedSections(view, merged);
          });
        }
      } else {
        existing.deletedAt = Date.now();
        handleDismissPopup();
      }
    } else {
      annotations.push(annotation);
      views.forEach((view) => view?.addAnnotation(annotation));
      setSelection({ ...selection, cfi, annotated: true });
      created = annotation;
    }

    const updatedConfig = updateBooknotes(bookKey, annotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }

    return created;
  };

  /**
   * Toggle the `global` flag on the annotation currently anchored at
   * `selection.cfi`. When enabling, fan out overlays for every other
   * occurrence of `selection.text` in the same section; when disabling,
   * tear them down. The original anchor highlight at `cfi` is left
   * untouched in either direction.
   *
   * Hidden for fixed-layout formats (PDF/CBZ) because they don't expose
   * a per-section text DOM we can scan.
   */
  const handleToggleGlobal = () => {
    if (!selection || !selection.cfi || !selection.text) return;
    if (bookData.isFixedLayout) return;
    const { booknotes: annotations = [] } = config;
    const idx = annotations.findIndex(
      (a) => a.type === 'annotation' && a.style && !a.deletedAt && a.cfi === selection.cfi,
    );
    if (idx === -1) return;
    const existing = annotations[idx]!;
    const nextGlobal = !existing.global;
    annotations[idx] = { ...existing, global: nextGlobal, updatedAt: Date.now() };
    const updatedConfig = updateBooknotes(bookKey, annotations);
    if (updatedConfig) {
      saveConfig(envConfig, bookKey, updatedConfig, settings);
    }

    const views = getViewsById(bookKey.split('-')[0]!);
    if (nextGlobal) {
      const updated = annotations[idx]!;
      views.forEach((v) => {
        if (v) expandAllRenderedSections(v, updated);
      });
    } else {
      views.forEach((v) => removeGlobalAnnotationOverlays(v, existing));
    }
  };

  const handleAnnotate = () => {
    if (!selection || !selection.text) return;
    const { sectionHref: href } = progress;
    selection.href = href;
    const created = handleHighlight(true);
    setNotebookVisible(true);
    setNotebookNewAnnotation(selection);
    // Remember the eagerly-created highlight so the notebook can remove it if the
    // note is never saved. A restyle of an existing highlight returns null — that
    // record predates this flow and must survive a cancel (#4791).
    setNotebookNewHighlightId(created?.id ?? null);
    handleDismissPopup();
  };

  const handleSearch = () => {
    if (!selection || !selection.text) return;
    handleDismissPopupAndSelection();
    let term = selection.text;
    eventDispatcher.dispatch('search-term', { term, bookKey });
  };

  const handleDictionary = () => {
    if (!selection || !selection.text) return;
    // System-dictionary path: when the user has opted in via Settings →
    // Languages → Dictionaries, hand the selection to the OS instead of
    // opening the in-app popup. Exclusivity is enforced at the store
    // level (enabling system disables everything else and vice versa),
    // so a single check on the system flag is sufficient.
    const dictSettings = useCustomDictionaryStore.getState().settings;
    if (isSystemDictionaryEnabled(dictSettings)) {
      // Build the macOS HUD anchor: the selection rect (so the HUD
      // appears at the original word) and the underlying paragraph's
      // text style (so AppKit re-draws the small label at the same
      // font size / colour as the original, matching the system
      // right-click → Look Up presentation).
      const rect = selection.range ? getRangeRectInWebview(selection.range) : null;
      const style = selection.range ? getRangeTextStyleInWebview(selection.range) : null;
      void invokeSystemDictionary(
        selection.text,
        rect ? { rect, style: style ?? undefined } : undefined,
      );
      handleDismissPopupAndSelection();
      return;
    }
    setShowAnnotPopup(false);
    setShowDictPopup(true);
  };

  const handleWikipedia = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowWikipediaPopup(true);
  };

  const handleTranslation = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowTsPopup(true);
  };

  const handleSpeakText = async (oneTime = false) => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setEditingAnnotation(null);
    eventDispatcher.dispatch('tts-speak', {
      bookKey,
      oneTime,
      // Clone so clearing the live selection below can't disturb the range
      // TTS uses to choose where to start.
      range: selection.range.cloneRange(),
      index: selection.index,
    });
    eventDispatcher.dispatch('tts-popup');
    // The word was only selected to pick where to start reading; drop the
    // selection so its highlight isn't left behind once TTS begins.
    view?.deselect();
  };

  const handleProofread = () => {
    // With no active selection the shortcut (Ctrl/Cmd+P) has nothing to turn
    // into a rule, so reuse it to open the replacement-rules manager instead.
    if (!selection || !selection.text) {
      setProofreadRulesVisibility(true);
      return;
    }
    setShowAnnotPopup(false);
    setShowProofreadPopup(true);

    if (getWordCount(selection.text) > 30) {
      eventDispatcher.dispatch('toast', {
        type: 'warning',
        message: _('Word limit of 30 words exceeded.'),
        timeout: 3000,
      });
      return;
    }
  };

  const handleStartEditAnnotation = useCallback(() => {
    setShowAnnotPopup(false);
  }, []);

  const handleExcerpt = () => {
    if (!selection || !selection.text) return;
    setShowAnnotPopup(false);
    setShowExcerptDialog(true);
  };

  // Keyboard shortcuts: trigger actions only if there's an active selection and popup hidden
  useShortcuts(
    {
      onHighlightSelection: () => {
        handleHighlight(false, 'highlight');
      },
      onUnderlineSelection: () => {
        handleHighlight(false, 'underline');
      },
      onAnnotateSelection: () => {
        handleAnnotate();
      },
      onSearchSelection: () => {
        handleSearch();
      },
      onCopySelection: () => {
        handleCopy(false);
      },
      onTranslateSelection: () => {
        handleTranslation();
      },
      onDictionarySelection: () => {
        handleDictionary();
      },
      onWikipediaSelection: () => {
        handleWikipedia();
      },
      onReadAloudSelection: () => {
        handleSpeakText();
      },
      onProofreadSelection: () => {
        handleProofread();
      },
    },
    [selection?.text],
  );

  const handleExportMarkdown = async (event: CustomEvent) => {
    const { bookKey: exportBookKey } = event.detail;
    if (bookKey !== exportBookKey) return;

    const { bookDoc, book } = bookData;
    if (!bookDoc || !book) return;

    const config = getConfig(bookKey)!;
    const { booknotes: allNotes = [] } = config;
    const booknotes = allNotes.filter((note) => !note.deletedAt);
    if (booknotes.length === 0) {
      eventDispatcher.dispatch('toast', {
        type: 'info',
        message: _('No annotations to export'),
        className: 'whitespace-nowrap',
        timeout: 2000,
      });
      return;
    }

    // Organize booknotes into groups by chapter
    const booknoteGroups: { [href: string]: BooknoteGroup } = {};
    for (const booknote of booknotes) {
      const tocItem = findTocItemBS(bookDoc.toc ?? [], booknote.cfi);
      const href = tocItem?.href || '';
      const label = tocItem?.label || '';
      const id = tocItem?.id || 0;
      if (!booknoteGroups[href]) {
        booknoteGroups[href] = { id, href, label, booknotes: [] };
      }
      booknoteGroups[href].booknotes.push(booknote);
    }

    Object.values(booknoteGroups).forEach((group) => {
      group.booknotes.sort((a, b) => {
        return CFI.compare(a.cfi, b.cfi);
      });
    });

    setExportData({ booknoteGroups });
    setShowExportDialog(true);
  };

  const handleConfirmExport = async (
    content: string,
    isPlainText: boolean,
    sharePos?: { x: number; y: number; preferredEdge?: 'top' | 'bottom' | 'left' | 'right' },
  ) => {
    const { book } = bookData;
    if (!book) return;

    setTimeout(() => {
      // Delay to ensure it won't be overridden by system clipboard actions
      void writeTextToClipboard(content);
    }, 100);

    const ext = isPlainText ? 'txt' : 'md';
    const mimeType = isPlainText ? 'text/plain' : 'text/markdown';
    const filename = `${makeSafeFilename(book.title)}.${ext}`;
    const saved = await appService?.saveFile(filename, content, {
      mimeType,
      share: true,
      sharePos,
    });

    if (appService?.isMacOSApp) return;
    eventDispatcher.dispatch('toast', {
      type: 'info',
      message: saved ? _('Exported successfully') : _('Copied to clipboard'),
      timeout: 2000,
    });
  };

  const handleCancelExport = () => {
    setShowExportDialog(false);
    setExportData(null);
  };

  const selectionAnnotated = selection?.annotated;
  // For the ✓ (global) toggle in HighlightOptions: figure out whether
  // the booknote anchored at the current selection is currently global,
  // and whether the toggle should be shown at all (only meaningful for
  // re-flowable formats with a non-empty selection text).
  const currentAnnotation = selection?.cfi
    ? config.booknotes?.find(
        (a) => a.type === 'annotation' && a.style && !a.deletedAt && a.cfi === selection.cfi,
      )
    : undefined;
  const globalToggleAvailable =
    !bookData.isFixedLayout &&
    !!selection?.annotated &&
    !!currentAnnotation &&
    !!selection?.text &&
    selection.text.trim().length > 0;
  const globalToggleActive = !!currentAnnotation?.global;
  const toolButtons = annotationToolButtons.map(({ type, label, Icon }) => {
    switch (type) {
      case 'copy':
        return { tooltipText: _(label), Icon, onClick: handleCopy };
      case 'highlight':
        return {
          tooltipText: selectionAnnotated ? _('Delete Highlight') : _(label),
          Icon: selectionAnnotated ? TbHighlightOff : Icon,
          onClick: handleHighlight,
        };
      case 'annotate':
        return {
          tooltipText: _(label),
          Icon,
          onClick: handleAnnotate,
        };
      case 'search':
        return {
          tooltipText: _(label),
          Icon,
          onClick: handleSearch,
        };
      case 'excerpt':
        return { tooltipText: _(label), Icon, onClick: handleExcerpt };
      case 'dictionary':
        return { tooltipText: _(label), Icon, onClick: handleDictionary };
      case 'wikipedia':
        return { tooltipText: _(label), Icon, onClick: handleWikipedia, visible: false };
      case 'translate':
        return { tooltipText: _(label), Icon, onClick: handleTranslation };
      case 'tts':
        return {
          tooltipText: _(label),
          Icon,
          onClick: handleSpeakText,
          visible: false, // disable TTS false
        };
      case 'proofread':
        return {
          tooltipText: _(label),
          Icon,
          onClick: handleProofread,
          disabled: bookData.book?.format !== 'EPUB',
        };
      default:
        return { tooltipText: '', Icon, onClick: () => {} };
    }
  });

  // The lookup popups never deselect (handleDictionary / handleTranslation /
  // handleProofread only flip popup flags), so a genuine selection is still
  // live when one closes — return to its toolbar instead of discarding it
  // (#5213). Word Lens gloss taps and taps on an existing highlight
  // synthesize their selection with isTextSelected left false, and an empty
  // toolbar has nothing to return to: those keep the full dismiss. The
  // consuming actions are a different class by design — copy, share, search,
  // and TTS spend the selection (TTS deselects deliberately), and highlight /
  // annotate replace it with the created annotation — so they are not here.
  const handleDismissPopupShowToolbar = () => {
    if (isTextSelected.current && toolButtons.length > 0) {
      handleShowAnnotPopup();
    } else {
      handleDismissPopupAndSelection();
    }
  };

  return (
    <div ref={containerRef} role='toolbar' tabIndex={-1}>
      {showDictPopup &&
        (() => {
          // Below `sm` (or short landscape) we present the dictionary as a
          // bottom sheet — the anchored popup gets cramped at this size.
          // Matches the `isMobile` heuristic used by `Dialog`.
          const useSheet = window.innerWidth < 640 || window.innerHeight < 640;
          const onManage = () => {
            // Dismiss so the user returns to the reader cleanly when they
            // close settings; the dictionaries sub-page in SettingsDialog
            // is enough surface for managing providers.
            handleDismissPopupAndSelection();
            setSettingsDialogBookKey(bookKey);
            setActiveSettingsItemId('settings.language.dictionaries.manage');
            setFontLayoutSettingsDialogOpen(true);
          };
          if (useSheet) {
            return (
              <DictionarySheet
                word={selection?.text as string}
                lang={bookData.bookDoc?.metadata.language as string}
                onDismiss={handleDismissPopupShowToolbar}
                onManage={onManage}
              />
            );
          }
          if (!trianglePosition || !dictPopupPosition) return null;
          return (
            <DictionaryPopup
              word={selection?.text as string}
              lang={bookData.bookDoc?.metadata.language as string}
              position={dictPopupPosition}
              trianglePosition={trianglePosition}
              popupWidth={dictPopupWidth}
              popupHeight={dictPopupHeight}
              onDismiss={handleDismissPopupShowToolbar}
              onManage={onManage}
            />
          );
        })()
      }
      {showWikipediaPopup && trianglePosition && dictPopupPosition && (
        <WikipediaPopup
          text={selection?.text as string}
          lang={bookData.bookDoc?.metadata.language as string}
          position={dictPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={dictPopupWidth}
          popupHeight={dictPopupHeight}
          onDismiss={handleDismissPopupShowToolbar}
        />
      )}
      {showTsPopup && trianglePosition && translatorPopupPosition && (
        <TranslatorPopup
          text={selection?.text as string}
          position={translatorPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={transPopupWidth}
          popupHeight={transPopupHeight}
          onDismiss={handleDismissPopupShowToolbar}
        />
      )}
      {showProofreadPopup && trianglePosition && proofreadPopupPosition && selection && (
        <ProofreadPopup
          bookKey={bookKey}
          selection={selection}
          position={proofreadPopupPosition}
          trianglePosition={trianglePosition}
          popupWidth={proofreadPopupWidth}
          popupHeight={proofreadPopupHeight}
          onDismiss={handleDismissPopupShowToolbar}
          onManage={() => {
            handleDismissPopupAndSelection();
            setProofreadRulesVisibility(true);
          }}
        />
      )}
      {!editingAnnotation && selection?.handlesSuppressed && selection.range && (
        <SelectionRangeEditor
          bookKey={bookKey}
          isVertical={viewSettings.vertical}
          selection={selection}
          handleColor={selectedColor}
          onRangeChange={applyProgrammaticSelection}
          onStartDrag={handleStartEditAnnotation}
          noteAutoTurnPoint={noteAutoTurnPoint}
          cancelAutoTurn={cancelAutoTurn}
          onAutoTurn={onAutoTurn}
        />
      )}
      {editingAnnotation && editingAnnotation.color && selection && (
        <AnnotationRangeEditor
          bookKey={bookKey}
          isVertical={viewSettings.vertical}
          annotation={editingAnnotation}
          selection={selection}
          handleColor={selectedColor}
          externalDragPoint={externalDragPoint}
          getAnnotationText={getAnnotationText}
          setSelection={setSelection}
          onStartEdit={handleStartEditAnnotation}
          noteAutoTurnPoint={noteAutoTurnPoint}
          cancelAutoTurn={cancelAutoTurn}
          onAutoTurn={onAutoTurn}
        />
      )}
      {showAnnotPopup && trianglePosition && annotPopupPosition && (
        <AnnotationPopup
          bookKey={bookKey}
          dir={viewSettings.rtl ? 'rtl' : 'ltr'}
          isVertical={viewSettings.vertical}
          buttons={toolButtons}
          notes={annotationNotes}
          position={annotPopupPosition}
          trianglePosition={trianglePosition}
          highlightOptionsVisible={highlightOptionsVisible}
          selectedStyle={selectedStyle}
          selectedColor={selectedColor}
          popupWidth={annotPopupWidth}
          popupHeight={annotPopupHeight}
          onHighlight={handleHighlight}
          onDismiss={handleDismissPopupAndSelection}
          globalToggleAvailable={globalToggleAvailable}
          globalToggleActive={globalToggleActive}
          onToggleGlobal={handleToggleGlobal}
        />
      )}
      {showExcerptDialog && selection && bookData.book && (
        <ExcerptDialog
          bookKey={bookKey}
          isOpen={showExcerptDialog}
          book={bookData.book}
          selection={selection}
          onCancel={() => setShowExcerptDialog(false)}
        />
      )}
      {showExportDialog && exportData && bookData.book && (
        <ExportMarkdownDialog
          bookKey={bookKey}
          isOpen={showExportDialog}
          bookHash={bookData.book.hash}
          bookTitle={bookData.book.title}
          bookAuthor={bookData.book.author || ''}
          booknoteGroups={exportData.booknoteGroups}
          onCancel={handleCancelExport}
          onExport={handleConfirmExport}
        />
      )}
    </div>
  );
};

export default Annotator;
