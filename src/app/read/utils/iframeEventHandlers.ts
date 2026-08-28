import { DOUBLE_CLICK_INTERVAL_THRESHOLD_MS, LONG_HOLD_THRESHOLD } from '@/services/constants';
import { eventDispatcher } from '@/utils/event';

let lastClickTime = 0;
let longHoldTimeout: ReturnType<typeof setTimeout> | null = null;
let isMouseDown = false;

let keyboardState = {
  key: '',
  code: '',
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
};

const getKeyStatus = (event?: MouseEvent | WheelEvent | TouchEvent) => {
  if (event && 'ctrlKey' in event) {
    return {
      key: keyboardState.key,
      code: keyboardState.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    };
  }
  return {
    ...keyboardState,
  };
};

export const handleKeydown = (bookKey: string, event: KeyboardEvent) => {
  keyboardState = {
    key: event.key,
    code: event.code,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };

  if (['Backspace'].includes(event.key)) {
    event.preventDefault();
  }

  if (event.ctrlKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
  }

  window.postMessage(
    {
      type: 'iframe-keydown',
      bookKey,
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
    '*',
  );
};

export const handleKeyup = (bookKey: string, event: KeyboardEvent) => {
  keyboardState = {
    key: '',
    code: '',
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };

  window.postMessage(
    {
      type: 'iframe-keyup',
      bookKey,
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    },
    '*',
  );
};

export const handleMousedown = (bookKey: string, event: MouseEvent) => {
  isMouseDown = true;
  longHoldTimeout = setTimeout(() => {
    longHoldTimeout = null;
  }, LONG_HOLD_THRESHOLD);

  window.postMessage(
    {
      type: 'iframe-mousedown',
      bookKey,
      button: event.button,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
      ...getKeyStatus(event),
    },
    '*',
  );
};

export const handleMouseup = (bookKey: string, event: MouseEvent) => {
  isMouseDown = false;
  // we will handle mouse back and forward buttons ourselves
  if ([3, 4].includes(event.button)) {
    event.preventDefault();
  }
  window.postMessage(
    {
      type: 'iframe-mouseup',
      bookKey,
      button: event.button,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
      ...getKeyStatus(event),
    },
    '*',
  );
};

export const handleWheel = (bookKey: string, event: WheelEvent) => {
  window.postMessage(
    {
      type: 'iframe-wheel',
      bookKey,
      deltaMode: event.deltaMode,
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaZ: event.deltaZ,
      screenX: event.screenX,
      screenY: event.screenY,
      clientX: event.clientX,
      clientY: event.clientY,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
      ...getKeyStatus(event),
    },
    '*',
  );
};

// A tappable media element under the pointer, resolved to the payload the image
// gallery / table zoom viewers consume.
type MediaTarget = { elementType: 'image'; src: string } | { elementType: 'table'; html: string };

const detectMediaTarget = (target: HTMLElement | null): MediaTarget | null => {
  if (!target) return null;
  if (target.localName === 'img') {
    return { elementType: 'image', src: (target as HTMLImageElement).src };
  }
  const svgImage = target.closest('svg')?.querySelector('image');
  if (svgImage) {
    const href =
      svgImage.getAttribute('href') ||
      svgImage.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
    if (href) return { elementType: 'image', src: href };
  }
  const table = target.localName === 'table' ? target : target.closest('table');
  if (table) return { elementType: 'table', html: (table as HTMLElement).outerHTML };
  return null;
};

export const handleClick = (
  bookKey: string,
  doubleClickDisabled: React.RefObject<boolean>,
  isFixedLayout: boolean,
  isComicBook: boolean,
  event: MouseEvent,
) => {
  const now = Date.now();

  if (!doubleClickDisabled.current && now - lastClickTime < DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
    lastClickTime = now;
    // A comic page is one full-bleed image with no text on it, so the
    // double-click that starts a word selection everywhere else is free to do
    // what a single tap does in a reflowable book: open the page in the image
    // viewer, the only surface that can zoom past page-fit and save/share the
    // image. Single tap cannot be used here - in fixed layout it is the
    // page-turn / toolbar gesture.
    const comicPage = isComicBook ? detectMediaTarget(event.target as HTMLElement | null) : null;
    if (comicPage?.elementType === 'image') {
      window.postMessage({ type: 'iframe-open-media', bookKey, ...comicPage }, '*');
      return;
    }
    window.postMessage(
      {
        type: 'iframe-double-click',
        bookKey,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.offsetX,
        offsetY: event.offsetY,
        ...getKeyStatus(event),
      },
      '*',
    );
    return;
  }

  lastClickTime = now;

  const postSingleClick = () => {
    const element = event.target as HTMLElement | null;
    const footnote = element?.closest(
      [
        '.js_readerFooterNote',
        '.zhangyue-footnote',
        '.duokan-footnote',
        '.qqreader-footnote',
      ]
      .join(', ')
    );
    // In reflowable books a single tap on an image/table opens the media
    // viewer. A media element wrapped in a plain link (e.g. a figure linking to
    // its full-resolution image) should still zoom rather than follow the link
    // (#4757). Footnotes are excluded so footnote links keep their
    // popup/navigation behavior.
    const media = !isFixedLayout && !footnote ? detectMediaTarget(element) : null;
    if (
      !media &&
      element?.closest('sup, a, audio, video') &&
      !element?.closest('a.duokan-footnote:not([href])')
    ) {
      return;
    }
    if (footnote) {
      eventDispatcher.dispatch('footnote-popup', {
        bookKey,
        element: footnote,
        footnote:
          footnote.getAttribute('data-wr-footernote') ||
          footnote.getAttribute('zy-footnote') ||
          footnote.querySelector('img')?.getAttribute('alt') ||
          footnote.getAttribute('alt') ||
          element?.getAttribute('alt') ||
          '',
      });
      return;
    }

    // if the mouse button is still held, a drag is in progress (e.g. a
    // double-click-and-drag selection); sending a single click here would turn
    // the page mid-selection (#4524).
    if (isMouseDown) {
      return;
    }

    // if long hold is detected, we don't want to send single click event
    if (!longHoldTimeout) {
      return;
    }

    // In reflowable books a single tap on an image/table opens the image gallery
    // / table zoom (#4584) — it is the only gesture that does, since long-press
    // fired mid-scroll and was removed (#5069). Fixed-layout books
    // (PDF/comics/manga) keep tap-to-turn, since there the tap is the page-turn
    // gesture (media is null there).
    if (media) {
      window.postMessage({ type: 'iframe-open-media', bookKey, ...media }, '*');
      return;
    }

    window.postMessage(
      {
        type: 'iframe-single-click',
        bookKey,
        screenX: event.screenX,
        screenY: event.screenY,
        clientX: event.clientX,
        clientY: event.clientY,
        offsetX: event.offsetX,
        offsetY: event.offsetY,
        ...getKeyStatus(event),
      },
      '*',
    );
  };
  
  if (!doubleClickDisabled.current) {
    setTimeout(() => {
      if (Date.now() - lastClickTime >= DOUBLE_CLICK_INTERVAL_THRESHOLD_MS) {
        postSingleClick();
      }
    }, DOUBLE_CLICK_INTERVAL_THRESHOLD_MS);
  } else {
    postSingleClick();
  }
};

const handleTouchEv = (bookKey: string, event: TouchEvent, type: string) => {
  // Use event.touches (all active touches) instead of event.targetTouches
  // so that multi-finger gestures work even when fingers land on different
  // elements within the iframe (e.g. canvas vs textLayer spans in PDF)
  const touchList = type === 'iframe-touchend' ? event.targetTouches : event.touches;
  const touches = [];
  for (let i = 0; i < touchList.length; i++) {
    const touch = touchList[i];
    if (touch) {
      touches.push({
        clientX: touch.clientX,
        clientY: touch.clientY,
        screenX: touch.screenX,
        screenY: touch.screenY,
      });
    }
  }
  window.postMessage(
    {
      type: type,
      bookKey,
      timeStamp: Date.now(),
      targetTouches: touches,
      ...getKeyStatus(event),
    },
    '*',
  );
};

export const handleTouchStart = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchstart');
};

export const handleTouchMove = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchmove');
};

export const handleTouchEnd = (bookKey: string, event: TouchEvent) => {
  handleTouchEv(bookKey, event, 'iframe-touchend');
};
