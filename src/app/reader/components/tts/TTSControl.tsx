import clsx from 'clsx';
import React, { useState, useRef, useEffect } from 'react';

import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResponsiveSize } from '@/hooks/useResponsiveSize';
import { getPopupPosition, Position } from '@/utils/sel';
import { eventDispatcher } from '@/utils/event';
import { Overlay } from '@/components/Overlay';
import Popup from '@/components/Popup';
import TTSPanel from './TTSPanel';
import { useTTSControl } from '../../hooks/useTTSControl';

const POPUP_WIDTH = 320;
const POPUP_HEIGHT = 60;
const POPUP_PADDING = 10;

interface TTSControlProps {
  bookKey: string;
  iconRef: React.RefObject<HTMLDivElement | null>,
}

const TTSControl: React.FC<TTSControlProps> = ({ bookKey, iconRef }) => {
  const _ = useTranslation();
  const { safeAreaInsets } = useThemeStore();

  const [showPanel, setShowPanel] = useState(false);
  const [panelPosition, setPanelPosition] = useState<Position>();
  const [trianglePosition, setTrianglePosition] = useState<Position>();

  const backButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [shouldMountBackButton, setShouldMountBackButton] = useState(false);
  const [isBackButtonVisible, setIsBackButtonVisible] = useState(false);

  const popupPadding = useResponsiveSize(POPUP_PADDING);
  const maxWidth = window.innerWidth - 2 * popupPadding;
  const popupWidth = Math.min(maxWidth, useResponsiveSize(POPUP_WIDTH));
  const popupHeight = useResponsiveSize(POPUP_HEIGHT);

  const tts = useTTSControl({
    bookKey,
    onRequestHidePanel: () => setShowPanel(false),
  });

  useEffect(() => {
    if (tts.showBackToCurrentTTSLocation) {
      setShouldMountBackButton(true);
      const fadeInTimeout = setTimeout(() => {
        setIsBackButtonVisible(true);
      }, 10);
      return () => clearTimeout(fadeInTimeout);
    } else {
      setIsBackButtonVisible(false);
      if (backButtonTimeoutRef.current) {
        clearTimeout(backButtonTimeoutRef.current);
      }
      backButtonTimeoutRef.current = setTimeout(() => {
        setShouldMountBackButton(false);
      }, 300);
      return;
    }
  }, [tts.showBackToCurrentTTSLocation]);

  const updatePanelPosition = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const parentRect =
        iconRef.current.parentElement?.getBoundingClientRect() ||
        document.documentElement.getBoundingClientRect();

      const trianglePos = {
        dir: 'up',
        point: { x: rect.left + rect.width / 2 - parentRect.left, y: rect.top - 12 },
      } as Position;

      const popupPos = getPopupPosition(
        trianglePos,
        parentRect,
        popupWidth,
        popupHeight,
        popupPadding,
      );

      setPanelPosition(popupPos);
      setTrianglePosition(trianglePos);
    }
  };

  useEffect(() => {
    if (!iconRef.current || !showPanel) return;
    const parentElement = iconRef.current.parentElement;
    if (!parentElement) return;

    const resizeObserver = new ResizeObserver(() => {
      updatePanelPosition();
    });
    resizeObserver.observe(parentElement);
    return () => {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPanel]);

  const handleTTSPopup = (_event: CustomEvent) => {
    togglePopup();
  };

  const togglePopup = () => {
    updatePanelPosition();
    if (!showPanel && tts.isTTSActive) {
      tts.refreshTtsLang();
    }
    setShowPanel(true);
  };

  const handleDismissPopup = () => {
    setShowPanel(false);
  };

  useEffect(() => {
    eventDispatcher.on('tts-popup', handleTTSPopup);
    return () => {
      eventDispatcher.off('tts-popup', handleTTSPopup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {shouldMountBackButton && (
        <div
          className={clsx(
            'absolute left-1/2 top-0 z-50 -translate-x-1/2',
            'transition-opacity duration-300',
            isBackButtonVisible ? 'opacity-100' : 'opacity-0',
            safeAreaInsets?.top ? '' : 'py-1',
          )}
          style={{
            top: `${safeAreaInsets?.top || 0}px`,
          }}
        >
          <button
            onClick={tts.handleBackToCurrentTTSLocation}
            className={clsx(
              'bg-base-300 rounded-full px-4 py-2 font-sans text-sm shadow-lg',
              safeAreaInsets?.top ? 'h-11' : 'h-9',
            )}
          >
            {_('Back to TTS Location')}
          </button>
        </div>
      )}
      {showPanel && <Overlay onDismiss={handleDismissPopup} />}
      {showPanel && panelPosition && trianglePosition && tts.ttsClientsInited && (
        <Popup
          width={popupWidth}
          minHeight={popupHeight}
          position={panelPosition}
          trianglePosition={trianglePosition}
          className='bg-base-200 flex shadow-lg'
          onDismiss={handleDismissPopup}
        >
          <TTSPanel
            bookKey={bookKey}
            ttsLang={tts.ttsLang}
            isPlaying={tts.isPlaying}
            timeoutOption={tts.timeoutOption}
            timeoutTimestamp={tts.timeoutTimestamp}
            onTogglePlay={tts.handleTogglePlay}
            onBackward={tts.handleBackward}
            onForward={tts.handleForward}
            onSetRate={tts.handleSetRate}
            onGetVoices={tts.handleGetVoices}
            onSetVoice={tts.handleSetVoice}
            onGetVoiceId={tts.handleGetVoiceId}
            onSelectTimeout={tts.handleSelectTimeout}
          />
        </Popup>
      )}
    </>
  );
};

export default TTSControl;
