import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';
import { RiArrowLeftSLine, RiArrowRightSLine, RiChatVoiceFill } from 'react-icons/ri';
import { RiArrowGoBackLine, RiArrowGoForwardLine, RiSpeakAiLine } from 'react-icons/ri';
import { RiArrowLeftDoubleLine, RiArrowRightDoubleLine } from 'react-icons/ri';
import { IoIosList as TOCIcon } from 'react-icons/io';
import { PiFeatherDuotone as NoteIcon } from 'react-icons/pi';
import { RxSlider as SliderIcon } from 'react-icons/rx';

import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useBookDataStore } from '@/store/bookDataStore';
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
  const { getConfig, setConfig } = useBookDataStore();
  const { hoveredBookKey, setHoveredBookKey } = useReaderStore();
  const { getView, getViewState, getProgress, getViewSettings } = useReaderStore();
  const { isSideBarVisible, setSideBarVisible } = useSidebarStore();
  const [actionTab, setActionTab] = React.useState('progress');
  const sliderHeight = useResponsiveSize(28);
  const tocIconSize = useResponsiveSize(23);

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

  const handleSetActionTab = (tab: string) => {
    setActionTab(actionTab === tab ? '' : tab);
    if (tab === 'tts') {
      setHoveredBookKey('');
      handleSpeakText();
    } else if (tab === 'toc') {
      setHoveredBookKey('');
      setSideBarVisible(true);
      const config = getConfig(bookKey);
      if (config && config.viewSettings) {
        config.viewSettings.sideBarTab = 'toc';
        setConfig(bookKey, config);
      }
    } else if (tab === 'note') {
      setHoveredBookKey('');
      setSideBarVisible(true);
      const config = getConfig(bookKey);
      if (config && config.viewSettings) {
        config.viewSettings.sideBarTab = 'annotations';
        setConfig(bookKey, config);
      }
    }
  };

  useEffect(() => {
    if (hoveredBookKey !== bookKey && actionTab !== 'progress') {
      setActionTab('');
    }
  }, [hoveredBookKey, bookKey, actionTab]);

  const isVisible = hoveredBookKey === bookKey;
  const ttsEnabled = viewState?.ttsEnabled;
  const progressInfo = bookFormat === 'PDF' ? section : pageinfo;
  const progressValid = !!progressInfo;
  const progressFraction =
    progressValid && progressInfo?.total > 0
      ? (progressInfo!.current + 1) / progressInfo!.total || 0
      : 0;

  const iconRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div
        className={clsx(
          'absolute bottom-0 left-0 z-10 hidden w-full sm:flex sm:h-[52px]',
          // show scroll bar when vertical and scrolled in desktop
          viewSettings?.vertical && viewSettings?.scrolled && 'sm:!bottom-3 sm:!h-7',
        )}
        onMouseEnter={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onTouchStart={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
      />
      <div
        className={clsx(
          'footer-bar shadow-xs absolute bottom-0 z-50 flex w-full flex-col',
          'sm:h-[52px] sm:justify-center',
          'sm:bg-base-100 border-base-300/50 border-t sm:border-none',
          'transition-[opacity,transform] duration-300',
          appService?.hasRoundedWindow && 'rounded-window-bottom-right',
          !isSideBarVisible && appService?.hasRoundedWindow && 'rounded-window-bottom-left',
          isHoveredAnim && 'hover-bar-anim',
          // show scroll bar when vertical and scrolled in desktop
          viewSettings?.vertical && viewSettings?.scrolled && 'sm:!bottom-3 sm:!h-7',
          isVisible
            ? `pointer-events-auto translate-y-0 opacity-100`
            : `pointer-events-none translate-y-full opacity-0 sm:translate-y-0`,
        )}
        dir={viewSettings?.rtl ? 'rtl' : 'ltr'}
        onMouseLeave={() => window.innerWidth >= 640 && setHoveredBookKey('')}
        aria-hidden={!isVisible}
      >
        {/*  footer progress bar */}
        <div
          className={clsx(
            'footerbar-progress bg-base-200 absolute bottom-16 flex w-full items-center px-4 transition-all',
            actionTab === 'progress'
              ? 'pointer-events-auto translate-y-0 pb-4 pt-8 ease-out'
              : 'pointer-events-none invisible translate-y-full overflow-hidden p-0 ease-in',
          )}
          style={{ bottom: `${gridInsets.bottom + 52}px` }}
        >
          <div className='flex w-full items-center justify-center gap-x-4'>
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
            'bg-base-200 z-50 mt-auto flex w-full items-center gap-x-4 justify-center p-2',
          )}
          style={{ paddingBottom: `${gridInsets.bottom + 16}px` }}
        >
          {!isSideBarVisible && (
            <>
              <Button
                icon={<TOCIcon size={tocIconSize} className='' />}
                onClick={() => handleSetActionTab('toc')}
                tooltip={_('TOC')}
                tooltipDirection='top'
              />
              <Button
                icon={<NoteIcon className='' />}
                onClick={() => handleSetActionTab('note')}
                tooltip={_('Annotate')}
                tooltipDirection='top'
              />
            </>
          )}
          <BookmarkToggler bookKey={bookKey} />
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
          <TranslationToggler bookKey={bookKey} />
          <Button
            icon={<SliderIcon className={clsx(actionTab === 'progress' && 'text-blue-500')} />}
            onClick={() => handleSetActionTab('progress')}
            tooltip={_('Progress')}
            tooltipDirection='top'
          />
        </div>
      </div>
      <TTSControl bookKey={bookKey} iconRef={iconRef} />
    </>
  );
};

export default FooterBar;
