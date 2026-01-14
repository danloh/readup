'use client';

import clsx from 'clsx';
import * as React from 'react';
import { useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useLibrary } from '@/hooks/useLibrary';
import { useTransferQueue } from '@/hooks/useTransferQueue';
import { useThemeStore } from '@/store/themeStore';
import { useReaderStore } from '@/store/readerStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useNotebookStore } from '@/store/notebookStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { eventDispatcher } from '@/utils/event';
import { interceptWindowOpen } from '@/utils/open';
import { mountAdditionalFonts } from '@/styles/font';
import { isTauriAppPlatform } from '@/services/environment';
import { getSysFontsList, setSystemUIVisibility } from '@/utils/bridge';
import { AuthWindow } from '@/components/AuthWindow';
import { UpdaterWindow } from '@/components/UpdaterWindow';
import { Toast } from '@/components/Toast';
import { getLocale } from '@/utils/misc';
import { initDayjs } from '@/utils/time';
import ReaderContent from './ReaderContent';
import { ProofreadRulesManager } from './ProofreadRules';

const Reader: React.FC<{ ids?: string }> = ({ ids }) => {
  const router = useRouter();
  const { appService } = useEnv();
  const { hoveredBookKey } = useReaderStore();
  const { settings } = useSettingsStore();
  const { getIsSideBarVisible, setSideBarVisible, sideBarBookKey } = useSidebarStore();
  const { isSideBarVisible, isSideBarPinned } = useSidebarStore();
  const { getIsNotebookVisible, setNotebookVisible } = useNotebookStore();
  const { isNotebookVisible, isNotebookPinned } = useNotebookStore();
  const { 
    isDarkMode, isRoundedWindow, systemUIAlwaysHidden, showSystemUI, dismissSystemUI 
  } = useThemeStore();
  const { acquireBackKeyInterception, releaseBackKeyInterception } = useDeviceControlStore();
  const { libraryLoaded } = useLibrary();

  useTheme({ systemUIVisible: settings.alwaysShowStatusBar, appThemeColor: 'base-100' });
  useScreenWakeLock(settings.screenWakeLock);
  useTransferQueue(libraryLoaded, 5000);

  useEffect(() => {
    mountAdditionalFonts(document);
    interceptWindowOpen();
    if (isTauriAppPlatform()) {
      setTimeout(getSysFontsList, 3000);
    }
    initDayjs(getLocale());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleKeyDown = (event: CustomEvent) => {
    if (event.detail.keyName === 'Back') {
      if (getIsSideBarVisible() && !isSideBarPinned) {
        setSideBarVisible(false);
      } else if (getIsNotebookVisible() && !isNotebookPinned) {
        setNotebookVisible(false);
      } else {
        eventDispatcher.dispatch('close-reader');
        router.back();
      }
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (!appService?.isAndroidApp) return;
    acquireBackKeyInterception();
    return () => {
      releaseBackKeyInterception();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService?.isAndroidApp]);

  useEffect(() => {
    if (appService?.isAndroidApp) {
      eventDispatcher.onSync('native-key-down', handleKeyDown);
    }
    return () => {
      if (appService?.isAndroidApp) {
        eventDispatcher.offSync('native-key-down', handleKeyDown);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appService?.isAndroidApp,
    sideBarBookKey,
    isSideBarPinned,
    isSideBarVisible,
    isNotebookPinned,
    isNotebookVisible,
  ]);

  useEffect(() => {
    if (!appService?.isMobileApp) return;
    const systemUIVisible = !!hoveredBookKey || settings.alwaysShowStatusBar;
    const visible = !!(systemUIVisible && !systemUIAlwaysHidden);
    setSystemUIVisibility({ visible, darkMode: isDarkMode });
    if (visible) {
      showSystemUI();
    } else {
      dismissSystemUI();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredBookKey]);

  return libraryLoaded && settings.globalReadSettings ? (
    <div
      className={clsx(
        'reader-page bg-base-100 text-base-content full-height select-none overflow-hidden',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <Suspense fallback={<div className='full-height'></div>}>
        <ReaderContent ids={ids} settings={settings} />
        <AuthWindow />
        <UpdaterWindow />
        <ProofreadRulesManager />
        <Toast />
      </Suspense>
    </div>
  ) : (
    <div className={clsx('full-height', !appService?.isLinuxApp && 'bg-base-100')}></div>
  );
};

export default Reader;
