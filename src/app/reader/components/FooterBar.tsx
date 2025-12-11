import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { RiArrowLeftSLine, RiArrowRightSLine, RiChatVoiceFill } from 'react-icons/ri';
import { RiArrowGoBackLine, RiArrowGoForwardLine, RiSpeakAiLine } from 'react-icons/ri';
import { RiArrowLeftDoubleLine, RiArrowRightDoubleLine } from 'react-icons/ri';
import { IoIosList as TOCIcon } from 'react-icons/io';
import { RxSlider as SliderIcon } from 'react-icons/rx';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { eventDispatcher } from '@/utils/event';
import { viewPagination } from '../hooks/usePagination';
import { PageInfo } from '@/types/book';
import { Insets } from '@/types/misc';
import Button from '@/components/Button';
import Slider from '@/components/Slider';
import BookmarkToggler from './BookmarkToggler';
import TranslationToggler from './TranslationToggler';
import TTSControl from './tts/TTSControl';

interface FooterBarProps {
  bookKey: string;
  bookFormat: string;
  section?: PageInfo;
  pageinfo?: PageInfo;
  isHoveredAnim: boolean;
  gridInsets: Insets;
}

const FooterBar: React.FC<FooterBarProps> = ({
  bookKey,
  bookFormat,
  section,
  pageinfo,
  isHoveredAnim,
  gridInsets,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { getConfig, setConfig, getBookData } = useBookDataStore();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const { getView, getViewState, getProgress, getViewSettings } = useReaderStore();
  const { isSideBarVisible, setSideBarVisible } = useSidebarStore();
  const { acquireBackKeyInterception, releaseBackKeyInterception } = useDeviceControlStore();

  const [actionTab, setActionTab] = useState('progress');
  const sliderHeight = useResponsiveSize(20);

  const config = getConfig(bookKey);
  const bookData = getBookData(bookKey);
  const view = getView(bookKey);
  const progress = getProgress(bookKey);
  const viewSettings = getViewSettings(bookKey);
  const viewState = getViewState(bookKey);

  const handleProgressChange = (value: number) => {
    view?.goToFraction(value / 100.0);
  };

  const handleGoPrevPage = () => {
    viewPagination(view, viewSettings, 'left');
  };

  const handleGoNextPage = () => {
    viewPagination(view, viewSettings, 'right');
  };

  const handleGoPrevSection = () => {
    if (view?.renderer.prevSection) {
      view?.renderer.prevSection();
    }
  };

  const handleGoNextSection = () => {
    if (view?.renderer.nextSection) {
      view?.renderer.nextSection();
    }
  };

  const handleGoBack = () => {
    view?.history.back();
  };

  const handleGoForward = () => {
    view?.history.forward();
  };

  const handleSpeakText = async () => {
    if (!view || !progress || !viewState) return;
    if (viewState.ttsEnabled) {
      eventDispatcher.dispatch('tts-stop', { bookKey });
    } else {
      eventDispatcher.dispatch('tts-speak', { bookKey });
      eventDispatcher.dispatch('tts-popup');
    }
  };
  const handleRePopup = async () => {
    eventDispatcher.dispatch('tts-popup');
  };

  const handleSetActionTab = useCallback(
    (tab: string) => {
      setActionTab((prevTab) => (prevTab === tab ? '' : tab));

      if (tab === 'tts') {
        if (viewState?.ttsEnabled) {
          setHoveredBookKey('');
        }
        handleSpeakText();
      } else if (tab === 'toc') {
        setHoveredBookKey('');
        if (config?.viewSettings) {
          config.viewSettings.sideBarTab = 'toc';
          setConfig(bookKey, config);
        }
        setSideBarVisible(true);
      } else if (tab === 'note') {
        setHoveredBookKey('');
        setSideBarVisible(true);
        if (config?.viewSettings) {
          config.viewSettings.sideBarTab = 'annotations';
          setConfig(bookKey, config);
        }
      }
    },
    [
      config,
      bookKey,
      viewState?.ttsEnabled,
      setConfig,
      setSideBarVisible,
      setHoveredBookKey,
      handleSpeakText,
    ],
  );

  useEffect(() => {
    if (hoveredBookKey !== bookKey && actionTab !== 'progress') {
      setActionTab('');
    }
  }, [hoveredBookKey, bookKey, actionTab]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent | CustomEvent) => {
      if (event instanceof CustomEvent) {
        if (event.detail.keyName === 'Back') {
          setHoveredBookKey('');
          return true;
        }
      } else {
        if (event.key === 'Escape') {
          setHoveredBookKey('');
        }
        event.stopPropagation();
      }
      return false;
    },
    [setHoveredBookKey],
  );

  useEffect(() => {
    if (!appService?.isAndroidApp) return;

    if (hoveredBookKey) {
      acquireBackKeyInterception();
      eventDispatcher.onSync('native-key-down', handleKeyDown);
    }
    return () => {
      if (hoveredBookKey) {
        releaseBackKeyInterception();
        eventDispatcher.offSync('native-key-down', handleKeyDown);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredBookKey]);

  const isVisible = hoveredBookKey === bookKey;
  const ttsEnabled = viewState?.ttsEnabled;
  const progressInfo = bookFormat === 'PDF' ? section : pageinfo;
  const progressValid = !!progressInfo;
  const progressFraction =
    progressValid && progressInfo?.total > 0
      ? (progressInfo!.current + 1) / progressInfo!.total || 0
      : 0;

  const iconRef = useRef<HTMLDivElement>(null);

  const needHorizontalScroll =
    (viewSettings?.vertical && viewSettings?.scrolled) ||
    (bookData?.isFixedLayout && viewSettings?.zoomLevel && viewSettings.zoomLevel > 100);

  return (
    <>
      <div
        className={clsx(
          'absolute bottom-0 left-0 z-10 flex h-[52px] w-full',
          needHorizontalScroll && 'sm:!bottom-3 sm:!h-7',
        )}
        onClick={() => setHoveredBookKey(bookKey)}
        onMouseEnter={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onTouchStart={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
      />
      <div
        className={clsx(
          'footer-bar shadow-xs absolute bottom-0 z-30 flex w-full flex-col',
          'sm:h-[52px] sm:justify-center',
          'sm:bg-base-100 border-base-300/50 border-t sm:border-none',
          'transition-[opacity,transform] duration-300',
          window.innerWidth < 640 ? 'fixed' : 'absolute',
          appService?.hasRoundedWindow && 'rounded-window-bottom-right',
          !isSideBarVisible && appService?.hasRoundedWindow && 'rounded-window-bottom-left',
          isHoveredAnim && 'hover-bar-anim',
          needHorizontalScroll && 'sm:!bottom-3 sm:!h-7',
          isVisible
            ? `pointer-events-auto translate-y-0 opacity-100`
            : `pointer-events-none translate-y-full opacity-0 sm:translate-y-0`,
        )}
        dir={viewSettings?.rtl ? 'rtl' : 'ltr'}
        onFocus={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onMouseLeave={() => window.innerWidth >= 640 && setHoveredBookKey('')}
        aria-hidden={!isVisible}
      >
        {/*  footer progress bar */}
        <div
          className={clsx(
            'footerbar-progress bg-base-200 absolute bottom-16 flex w-full items-center px-4 transition-all',
            actionTab === 'progress'
              ? 'pointer-events-auto translate-y-0 py-2 ease-out'
              : 'pointer-events-none invisible translate-y-full overflow-hidden p-0 ease-in',
          )}
          style={{ bottom: `${gridInsets.bottom * 0.33 + 52}px` }}
        >
          <div className='flex w-full items-center justify-center gap-x-2'>
            <Button
              icon={viewSettings?.rtl ? <RiArrowGoForwardLine /> : <RiArrowGoBackLine />}
              onClick={handleGoBack}
              tooltip={_('Go Back')}
              disabled={!view?.history.canGoBack}
            />
            <Button
              icon={viewSettings?.rtl ? <RiArrowGoBackLine /> : <RiArrowGoForwardLine />}
              onClick={handleGoForward}
              tooltip={_('Go Forward')}
              disabled={!view?.history.canGoForward}
            />
            <Button
              icon={viewSettings?.rtl ? <RiArrowRightDoubleLine /> : <RiArrowLeftDoubleLine />}
              onClick={viewSettings?.rtl ? handleGoNextSection : handleGoPrevSection}
              tooltip={viewSettings?.rtl ? _('Next Section') : _('Previous Section')}
            />
            <Button
              icon={viewSettings?.rtl ? <RiArrowRightSLine /> : <RiArrowLeftSLine />}
              onClick={viewSettings?.rtl ? handleGoNextPage : handleGoPrevPage}
              tooltip={viewSettings?.rtl ? _('Next Page') : _('Previous Page')}
            />
            <Button
              icon={viewSettings?.rtl ? <RiArrowLeftSLine /> : <RiArrowRightSLine />}
              onClick={viewSettings?.rtl ? handleGoPrevPage : handleGoNextPage}
              tooltip={viewSettings?.rtl ? _('Previous Page') : _('Next Page')}
            />
            <Button
              icon={viewSettings?.rtl ? <RiArrowLeftDoubleLine /> : <RiArrowRightDoubleLine />}
              onClick={viewSettings?.rtl ? handleGoPrevSection : handleGoNextSection}
              tooltip={viewSettings?.rtl ? _('Previous Section') : _('Next Section')}
            />
            <Slider
              heightPx={sliderHeight}
              bubbleLabel={`${Math.round(progressFraction * 100)}%`}
              initialValue={progressValid ? progressFraction * 100 : 0}
              onChange={(e) => handleProgressChange(e)}
            />
          </div>
        </div>
        <div
          ref={iconRef}
          className={clsx(
            'bg-base-200 z-30 mt-auto flex w-full items-center gap-x-2 justify-center p-1',
          )}
          style={{ paddingBottom: `${gridInsets.bottom * 0.33 + 16}px` }}
        >
          {!isSideBarVisible && (
            <Button
              icon={<TOCIcon className='' />}
              onClick={() => handleSetActionTab('toc')}
              tooltip={_('TOC')}
              tooltipDirection='top'
            />
          )}
          <BookmarkToggler bookKey={bookKey} />
          <Button
            icon={<SliderIcon className={clsx(actionTab === 'progress' && 'text-blue-500')} />}
            onClick={() => handleSetActionTab('progress')}
            tooltip={_('Progress')}
            tooltipDirection='top'
          />
          <TranslationToggler bookKey={bookKey} />
          <div
            className={clsx(
              'flex items-center justify-center',
              viewState?.ttsEnabled && 'gap-x-1 bg-base-300 rounded-sm',
            )}
          >
            <Button
              icon={<RiSpeakAiLine className={ttsEnabled ? 'text-blue-500' : ''} />}
              onClick={() => handleSetActionTab('tts')}
              tooltip={_('Audio')}
              tooltipDirection='top'
            />
            {(viewState?.ttsEnabled) && (
              <Button
                icon={<RiChatVoiceFill />}
                onClick={handleRePopup}
                tooltip={_('Popup')}
                tooltipDirection='top'
              />
            )}
          </div>
        </div>
      </div>
      <TTSControl bookKey={bookKey} iconRef={iconRef} />
    </>
  );
};

export default FooterBar;
