import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { GrSystem } from "react-icons/gr";
import { MdZoomOut, MdZoomIn, MdSync, MdSyncProblem } from 'react-icons/md';
import { PiScrollLight, PiBookOpenLight, PiParagraphFill } from "react-icons/pi";
import { BiCheckboxChecked, BiCheckbox, BiMoon, BiSun } from "react-icons/bi";
import { IoMdExpand, IoMdShare } from 'react-icons/io';
import { TbArrowAutofitWidth, TbColumns1, TbColumns2 } from 'react-icons/tb';

import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL, ZOOM_STEP } from '@/services/constants';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';
import { setAuthDialogVisible } from '@/components/AuthWindow';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useTranslation } from '@/hooks/useTranslation';
import { getStyles } from '@/styles/style';
import { eventDispatcher } from '@/utils/event';
import { getMaxInlineSize } from '@/utils/config';
import { tauriHandleToggleFullScreen } from '@/utils/window';
import { saveViewSettings } from '@/helpers/settings';
import { formatLocaleDateTime } from '@/utils/book';
import { writeTextToClipboard } from '@/utils/clipboard';

interface ViewMenuProps {
  bookKey: string;
  setIsDropdownOpen?: (open: boolean) => void;
}

const ViewMenu: React.FC<ViewMenuProps> = ({
  bookKey,
  setIsDropdownOpen,
}) => {
  const _ = useTranslation();
  const { user } = useAuth();
  const { envConfig, appService } = useEnv();
  const { getBookData } = useBookDataStore();
  const { getView, getViewSettings, getProgress, setViewSettings } = useReaderStore();
  const bookData = getBookData(bookKey)!;
  const viewSettings = getViewSettings(bookKey)!;

  const { themeMode, setThemeMode } = useThemeStore();
  const [isScrolledMode, setScrolledMode] = useState(viewSettings!.scrolled);
  const [isParagraphMode, setParagraphMode] = useState(
    viewSettings?.paragraphMode?.enabled ?? false,
  );

  const [zoomLevel, setZoomLevel] = useState(viewSettings!.zoomLevel!);
  const [zoomMode, setZoomMode] = useState(viewSettings!.zoomMode!);
  const [spreadMode, setSpreadMode] = useState(viewSettings!.spreadMode!);
  const [keepCoverSpread, setKeepCoverSpread] = useState(viewSettings!.keepCoverSpread!);
  const [invertImgColor, setInvertImgColor] = useState(
    viewSettings!.invertImgColor,
  );
  const [applyThemeToPDF, setApplyThemeToPDF] = useState(viewSettings!.applyThemeToPDF!);

  const zoomIn = () => setZoomLevel((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM_LEVEL));
  const zoomOut = () => setZoomLevel((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM_LEVEL));
  const resetZoom = () => setZoomLevel(100);
  const toggleScrolledMode = () => setScrolledMode(!isScrolledMode);
  const toggleParagraphMode = () => {
    setParagraphMode(!isParagraphMode);
    eventDispatcher.dispatch('toggle-paragraph-mode', { bookKey });
    setIsDropdownOpen?.(false);
  };

  const cycleThemeMode = () => {
    const nextMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(nextMode);
  };

  const handleFullScreen = () => {
    tauriHandleToggleFullScreen();
    setIsDropdownOpen?.(false);
  };

  // sync config
  const handleSync = () => {
    if (!user) {
      setAuthDialogVisible(true);
      setIsDropdownOpen?.(false);
    } else {
      eventDispatcher.dispatch('sync-book-config', { bookKey });
    }
  };

  const handleStartRSVP = () => {
    setIsDropdownOpen?.(false);
    eventDispatcher.dispatch('rsvp-start', { bookKey });
  };

  const handleShare = async () => {
    setIsDropdownOpen?.(false);
    const book = bookData?.book;
    if (!book) return;
    
    if (!user) {
      eventDispatcher.dispatch('toast', {
        message: _('Sign in to share book'),
        timeout: 2000,
        type: 'warning',
      });
      return;
    }

    let bookUploaded = !!book.uploadedAt;
    // upload book to PDS for sharing
    if (!bookUploaded && appService) {
      eventDispatcher.dispatch('toast', {
        message: 'Uploading book to PDS...',
        timeout: 1000,
        type: 'info',
      });
      try {
        await appService.uploadBook(book, false);
        eventDispatcher.dispatch('toast', {
          message: 'Book uploaded successfully',
          timeout: 1000,
          type: 'info',
        });
        await useLibraryStore.getState().updateBook(envConfig, book);
        bookUploaded = true;
      } catch (uploadError) {
        console.error('Failed to upload book:', uploadError);
        eventDispatcher.dispatch('toast', {
          message: `Failed to upload book: ${uploadError}`,
          timeout: 2000,
          type: 'warning',
        });
        return;
      }
    }

    if (bookUploaded) {
      // build share url
      const progress = getProgress(bookKey);
      const loc = progress?.location;
      const shareUrl = loc 
        ? `https://readup.cc/share?id=${book.hash}&did=${user.did}&loc=${encodeURIComponent(loc)}`
        : `https://readup.cc/share?id=${book.hash}&did=${user.did}`;
      
      // copy the shareUrl
      void writeTextToClipboard(shareUrl);
      eventDispatcher.dispatch('toast', {
        message: _('You hare copied the link, share it to share the book'),
        timeout: 5000,
        type: 'info',
      });
    } else {
      eventDispatcher.dispatch('toast', {
        message: 'Cannot share the book',
        timeout: 2000,
        type: 'warning',
      });
    }
  };

  useEffect(() => {
    if (isScrolledMode === viewSettings!.scrolled) return;
    viewSettings!.scrolled = isScrolledMode;
    getView(bookKey)?.renderer.setAttribute('flow', isScrolledMode ? 'scrolled' : 'paginated');
    getView(bookKey)?.renderer.setAttribute(
      'max-inline-size',
      `${getMaxInlineSize(viewSettings)}px`,
    );
    getView(bookKey)?.renderer.setStyles?.(getStyles(viewSettings!));
    setViewSettings(bookKey, viewSettings!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrolledMode]);

  useEffect(() => {
    if (zoomLevel === viewSettings.zoomLevel) return;
    saveViewSettings(envConfig, bookKey, 'zoomLevel', zoomLevel, true, true);
    if (bookData.bookDoc?.rendition?.layout === 'pre-paginated') {
      getView(bookKey)?.renderer.setAttribute('scale-factor', zoomLevel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel]);

  useEffect(() => {
    if (invertImgColor === viewSettings.invertImgColor) return;
    saveViewSettings(envConfig, bookKey, 'invertImgColor', invertImgColor, true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invertImgColor]);

  useEffect(() => {
    if (applyThemeToPDF === viewSettings.applyThemeToPDF) return;
    saveViewSettings(envConfig, bookKey, 'applyThemeToPDF', applyThemeToPDF, true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyThemeToPDF]);

  useEffect(() => {
    if (zoomMode === viewSettings.zoomMode) return;
    viewSettings.zoomMode = zoomMode;
    getView(bookKey)?.renderer.setAttribute('zoom', zoomMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'zoomMode', zoomMode, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomMode]);

  useEffect(() => {
    if (spreadMode === viewSettings.spreadMode) return;
    viewSettings.spreadMode = spreadMode;
    getView(bookKey)?.renderer.setAttribute('spread', spreadMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'spreadMode', spreadMode, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spreadMode]);

  useEffect(() => {
    if (keepCoverSpread === viewSettings.keepCoverSpread) return;
    if (!bookData?.bookDoc?.sections?.length) return;
    viewSettings.keepCoverSpread = keepCoverSpread;
    const coverSide = bookData.bookDoc.dir === 'rtl' ? 'right' : 'left';
    bookData.bookDoc.sections[0]!.pageSpread = keepCoverSpread ? '' : coverSide;
    getView(bookKey)?.renderer.setAttribute('spread', spreadMode);
    setViewSettings(bookKey, viewSettings);
    saveViewSettings(envConfig, bookKey, 'keepCoverSpread', keepCoverSpread, true, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepCoverSpread]);

  const lastSyncTime = bookData.book?.configSyncedAt || 0;

  return (
    <Menu
      className={clsx(
        'view-menu dropdown-content dropdown-right no-triangle z-20 mt-1 border',
        'bgcolor-base-200 shadow-2xl',
      )}
      style={{
        maxWidth: `${window.innerWidth - 40}px`,
        marginRight: window.innerWidth < 640 ? '-36px' : '0px',
      }}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      {bookData.bookDoc?.rendition?.layout === 'pre-paginated' && (
        <>
          <div 
            title={_('Zoom Level')} 
            className={clsx('flex items-center justify-between rounded-md')}
          >
            <button
              title={_('Zoom Out')}
              onClick={zoomOut}
              className={clsx(
                'hover:bg-base-300 text-base-content rounded-full p-2',
                zoomLevel <= MIN_ZOOM_LEVEL && 'btn-disabled text-gray-400',
              )}
            >
              <MdZoomOut />
            </button>
            <button
              title={_('Reset Zoom')}
              className={clsx(
                'hover:bg-base-300 text-base-content h-8 min-h-8 w-[50%] rounded-md p-1 text-center',
              )}
              onClick={resetZoom}
            >
              {Math.round(zoomLevel)}%
            </button>
            <button
              title={_('Zoom In')}
              onClick={zoomIn}
              className={clsx(
                'hover:bg-base-300 text-base-content rounded-full p-2',
                zoomLevel >= MAX_ZOOM_LEVEL && 'btn-disabled text-gray-400',
              )}
            >
              <MdZoomIn />
            </button>
          </div>
        
          <>
            <div 
              title={_('Zoom Mode')} 
              className={clsx('my-2 flex items-center justify-between rounded-md')}
            >
              <button
                onClick={setSpreadMode.bind(null, 'none')}
                title={_('Single Page')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  spreadMode === 'none' && 'bg-base-300/75',
                )}
              >
                <TbColumns1 />
              </button>
              <button
                onClick={setSpreadMode.bind(null, 'auto')}
                title={_('Auto Spread')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  spreadMode === 'auto' && 'bg-base-300/75',
                )}
              >
                <TbColumns2 />
              </button>
              <div className='bg-base-300 mx-2 h-6 w-[1px]' />
              <button
                title={_('Fit Page')}
                onClick={setZoomMode.bind(null, 'fit-page')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  zoomMode === 'fit-page' && 'bg-base-300/75',
                )}
              >
                <IoMdExpand />
              </button>
              <button
                title={_('Fit Width')}
                onClick={setZoomMode.bind(null, 'fit-width')}
                className={clsx(
                  'hover:bg-base-300 text-base-content rounded-full p-2',
                  zoomMode === 'fit-width' && 'bg-base-300/75',
                )}
              >
                <TbArrowAutofitWidth />
              </button>
            </div>

            <MenuItem
              label={_('Separate Cover Page')}
              Icon={keepCoverSpread ? BiCheckboxChecked : BiCheckbox}
              onClick={() => setKeepCoverSpread(!keepCoverSpread)}
              disabled={spreadMode === 'none'}
            />
          </>
          <hr aria-hidden='true' className='border-base-300 my-1' />
        </>
      )}
      
      <MenuItem
        label={isScrolledMode ? _('Scrolled Mode') : _('Page Mode')}
        shortcut='Shift+J'
        Icon={isScrolledMode ? PiScrollLight : PiBookOpenLight}
        onClick={toggleScrolledMode}
      />
      <MenuItem
        label={_('Paragraph Mode')}
        shortcut='Shift+P'
        Icon={isParagraphMode ? PiParagraphFill : BiCheckbox}
        onClick={toggleParagraphMode}
        disabled={bookData.isFixedLayout}
      />
      <MenuItem
        label={_('Speed Reading Mode')}
        shortcut='Shift+V'
        Icon={BiCheckbox}
        onClick={handleStartRSVP}
        disabled={bookData.isFixedLayout}
      />

      {appService?.hasWindow && <MenuItem label={_('Fullscreen')} onClick={handleFullScreen} />}
      <MenuItem
        label={
          themeMode === 'dark'
            ? _('Dark Mode')
            : themeMode === 'light'
              ? _('Light Mode')
              : _('Auto Mode')
        }
        Icon={themeMode === 'dark' ? BiMoon : themeMode === 'light' ? BiSun : GrSystem}
        onClick={cycleThemeMode}
      />
      <MenuItem
        label={_('Invert Image Colors')}
        Icon={invertImgColor ? BiCheckboxChecked : BiCheckbox}
        onClick={() => setInvertImgColor(!invertImgColor)}
      />
      {bookData.book?.format === 'PDF' && appService?.supportsCanvasContext2DFilter && (
        <MenuItem
          label={_('Apply Theme Colors to PDF')}
          Icon={applyThemeToPDF ? BiCheckboxChecked : BiCheckbox}
          onClick={() => setApplyThemeToPDF(!applyThemeToPDF)}
        />
      )}
      <hr aria-hidden='true' className='border-base-300 my-1' />
      <MenuItem label={_('Share Book')} Icon={IoMdShare} onClick={handleShare} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem
        label={
          !user
            ? _('Sign in to Sync')
            : lastSyncTime
              ? _('Synced at {{time}}', {
                  time: formatLocaleDateTime(lastSyncTime),
                })
              : _('Never synced')
        }
        Icon={user ? MdSync : MdSyncProblem}
        description={_('Sync annotations, progress...')}
        onClick={handleSync}
      />
    </Menu>
  );
};

export default ViewMenu;
