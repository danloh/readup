import clsx from 'clsx';
import Head from 'next/head';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PiDotsThreeVerticalBold } from 'react-icons/pi';

import { saveViewSettings } from '@/helpers/settings';
import { AnnotationToolType } from '@/types/annotator';
import { Insets } from '@/types/misc';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useTrafficLight } from '@/hooks/useTrafficLight';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { useTranslation } from '@/hooks/useTranslation';
import WindowButtons from '@/components/WindowButtons';
import Dropdown from '@/components/Dropdown';
import Logo from '@/components/Logo';
import SidebarToggler from './SidebarToggler';
import NotebookToggler from './NotebookToggler';
import SettingsToggler from './SettingsToggler';
import ViewMenu from './ViewMenu';
import { annotationToolQuickActions } from './annotator/AnnotationTools';
import QuickActionMenu from './annotator/QuickActionMenu';

interface HeaderBarProps {
  bookKey: string;
  bookTitle: string;
  isTopLeft: boolean;
  isHoveredAnim: boolean;
  gridInsets: Insets;
  screenInsets: Insets;
  onCloseBook: (bookKey: string) => void;
  onGoToLibrary: () => void;
  onDropdownOpenChange?: (isOpen: boolean) => void;
}

const HeaderBar: React.FC<HeaderBarProps> = ({
  bookKey,
  bookTitle,
  isTopLeft,
  isHoveredAnim,
  gridInsets,
  screenInsets,
  onCloseBook,
  onGoToLibrary,
  onDropdownOpenChange,
}) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const headerRef = useRef<HTMLDivElement>(null);
  const { isTrafficLightVisible } = useTrafficLight();
  const { trafficLightInFullscreen, setTrafficLightVisibility } = useTrafficLightStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [headerWidth, setHeaderWidth] = useState(0);
  const { bookKeys, getView, getViewSettings, hoveredBookKey, setHoveredBookKey } = 
    useReaderStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { isSideBarVisible, getIsSideBarVisible } = useSidebarStore();
  const iconSize16 = useResponsiveSize(16);

  const viewSettings = getViewSettings(bookKey);
  const view = getView(bookKey);
  const docs = view?.renderer.getContents() ?? [];
  const pointerInDoc = docs.some(({ doc }) => doc?.body?.style.cursor === 'pointer');

  const enableAnnotationQuickActions = viewSettings?.enableAnnotationQuickActions;
  const annotationQuickActionButton =
    annotationToolQuickActions.find(
      (button) => button.type === viewSettings?.annotationQuickAction,
    ) || annotationToolQuickActions[0]!;
  const annotationQuickAction = viewSettings?.annotationQuickAction;
  const AnnotationToolQuickActionIcon = annotationQuickActionButton.Icon;

  const handleAnnotationQuickActionSelect = (action: AnnotationToolType | null) => {
    if (viewSettings?.annotationQuickAction === action) action = null;
    saveViewSettings(envConfig, bookKey, 'annotationQuickAction', action, false, true);
  };

  const handleToggleDropdown = (isOpen: boolean) => {
    setIsDropdownOpen(isOpen);
    onDropdownOpenChange?.(isOpen);
    if (!isOpen) setHoveredBookKey('');
  };

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    if (hoveredBookKey === bookKey && isTopLeft) {
      setTrafficLightVisibility(true, { x: 10, y: 20 });
    } else if (!hoveredBookKey) {
      setTimeout(() => {
        if (!getIsSideBarVisible()) {
          setTrafficLightVisibility(false);
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService, hoveredBookKey]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setHeaderWidth(entry.contentRect.width);
    });
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  // Check if mouse is outside header area to avoid false positive event of MouseLeave when clicking inside header on Windows
  const isMouseOutsideHeader = useCallback((clientX: number, clientY: number) => {
    if (!headerRef.current) return true;

    const rect = headerRef.current.getBoundingClientRect();
    return (
      clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom
    );
  }, []);

  const isHeaderCompact = headerWidth > 0 && headerWidth < 350;
  const insets = window.innerWidth < 640 ? screenInsets : gridInsets;
  const isHeaderVisible = hoveredBookKey === bookKey || isDropdownOpen;
  const trafficLightInHeader =
    appService?.hasTrafficLight && !trafficLightInFullscreen && !isSideBarVisible && isTopLeft;
  const windowButtonVisible =
    appService?.hasWindowBar && !isTrafficLightVisible && !trafficLightInHeader;

  return (
    <div
      className={clsx(
        'left-0 top-0 w-full',
        isHeaderVisible && 'bg-base-100',
        window.innerWidth < 640 ? 'fixed z-20' : 'absolute',
      )}
      style={{
        paddingTop: appService?.hasSafeAreaInset ? `${insets.top}px` : '0px',
      }}
    >
      <Head><title>{bookTitle}</title></Head>
      <div
        role='none'
        tabIndex={-1}
        className={clsx('absolute top-0 z-10 h-10 w-full', pointerInDoc && 'pointer-events-none')}
        onClick={() => setHoveredBookKey(bookKey)}
        onMouseEnter={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onTouchStart={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
      />
      <div
        className={clsx(
          'bg-base-100 absolute left-0 right-0 top-0 z-10',
          appService?.hasRoundedWindow && 'rounded-window-top-right',
          isHeaderVisible ? 'visible' : 'hidden',
        )}
        style={{
          height: systemUIVisible ? `${Math.max(insets.top, statusBarHeight)}px` : '0px',
        }}
      />
      <div
        ref={headerRef}
        role='banner'
        aria-label={_('Header Bar')}
        className={clsx(
          `header-bar bg-base-100 absolute top-0 z-10 flex h-10 w-full items-center pr-4`,
          `shadow-xs transition-[opacity,margin-top] duration-300`,
          trafficLightInHeader ? 'pl-20' : isSideBarVisible ? 'ps-4' : 'ps-4 sm:ps-1.5',
          appService?.hasRoundedWindow && 'rounded-window-top-right',
          !isSideBarVisible && appService?.hasRoundedWindow && 'rounded-window-top-left',
          isHoveredAnim && 'hover-bar-anim',
          isHeaderVisible ? 'pointer-events-auto visible' : 'pointer-events-none opacity-0',
          isDropdownOpen && 'header-bar-pinned',
        )}
        style={{
          marginTop: systemUIVisible
            ? `${Math.max(insets.top, statusBarHeight)}px`
            : `${insets.top}px`,
        }}
        onFocus={() => !appService?.isMobile && setHoveredBookKey(bookKey)}
        onMouseLeave={(e) => {
          if (!appService?.isMobile && isMouseOutsideHeader(e.clientX, e.clientY)) {
            setHoveredBookKey('');
          }
        }}
      >
        <div className='header-tools-start bg-base-100 z-20 flex h-full items-center gap-x-2 pe-2'>
          {!isSideBarVisible && (
            <div className='flex items-center justify-start gap-x-2'>
              <button
                title={_('Go to Library')}
                className='btn btn-ghost h-8 min-h-8 w-8 p-0 flex'
                onClick={onGoToLibrary}
              >
                <Logo />
              </button>
              <div className='flex'>
                <SidebarToggler bookKey={bookKey} />
              </div>
            </div>
          )}
          {enableAnnotationQuickActions && (
            <Dropdown
              label={
                annotationQuickAction
                  ? _('Disable Quick Action')
                  : _('Enable Quick Action on Selection')
              }
              className='exclude-title-bar-mousedown dropdown-bottom'
              // menuClassName='!relative'
              buttonClassName={clsx(
                'btn btn-ghost h-8 min-h-8 w-8 p-0',
                viewSettings?.annotationQuickAction && 'bg-base-300/50',
              )}
              toggleButton={<AnnotationToolQuickActionIcon size={iconSize16} />}
              onToggle={handleToggleDropdown}
            >
              <QuickActionMenu
                selectedAction={viewSettings.annotationQuickAction}
                onActionSelect={handleAnnotationQuickActionSelect}
              />
            </Dropdown>
          )}
        </div>

        <div
          role='contentinfo'
          aria-label={_('Title') + ' - ' + bookTitle}
          className={clsx(
            'header-title z-15 bg-base-100 pointer-events-none hidden flex-1 items-center justify-center sm:flex',
            !windowButtonVisible && 'absolute inset-0',
            isHeaderCompact && '!hidden',
          )}
        >
          <h2
            aria-hidden='true'
            className={clsx(
              'line-clamp-1 text-center text-xs font-semibold',
              !windowButtonVisible && 'max-w-[50%]',
            )}
          >
            {bookTitle}
          </h2>
        </div>

        <div className='header-tools-end bg-base-100 z-20 ms-auto flex h-full items-center gap-x-2 ps-2'>
          <SettingsToggler bookKey={bookKey} />
          <NotebookToggler bookKey={bookKey} />
          <Dropdown
            className='exclude-title-bar-mousedown dropdown-bottom dropdown-end'
            buttonClassName='btn btn-ghost h-8 min-h-8 w-8 p-0'
            toggleButton={<PiDotsThreeVerticalBold size={iconSize16} />}
            onToggle={handleToggleDropdown}
          >
            <ViewMenu bookKey={bookKey} />
          </Dropdown>

          <WindowButtons
            className='window-buttons flex items-center'
            headerRef={headerRef}
            showMinimize={bookKeys.length == 1 && windowButtonVisible}
            showMaximize={bookKeys.length == 1 && windowButtonVisible}
            closeButtonLabel={_('Close Book')}
            onClose={() => {
              setHoveredBookKey(null);
              onCloseBook(bookKey);
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default HeaderBar;
