'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLight } from '@/hooks/useTrafficLight';
import { useEnv } from '@/context/EnvContext';
import Dropdown from '@/components/Dropdown';
import { AboutWindow } from '@/components/AboutWindow';
import { AuthWindow } from '@/components/AuthWindow';
import { UpdaterWindow } from '@/components/UpdaterWindow';
import WindowButtons from '@/components/WindowButtons';
import SettingsDialog from '@/components/settings/SettingsDialog';
import { KeyboardShortcutsHelp } from '@/components/KeyboardShortcutsHelp';
import Logo from '@/components/Logo';
import { Toast } from '@/components/Toast';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { checkAppReleaseNotes, checkForAppUpdates } from '@/helpers/updater';
import { 
  tauriHandleClose, tauriHandleSetAlwaysOnTop, tauriHandleToggleFullScreen, tauriQuitApp 
} from '@/utils/window';
import useShortcuts from '@/hooks/useShortcuts';
import { isTauriAppPlatform } from '@/services/environment';
import { useScreenWakeLock } from '@/hooks/useScreenWakeLock';
import { lockScreenOrientation } from '@/utils/bridge';
import SettingsMenu from './SettingsMenu';
import { MigrateDataWindow } from './MigrateDataWindow';

/** App logo that opens the main settings menu. */
export const LogoMenu: React.FC = () => {
  const _ = useTranslation();
  return (
    <div className='logo-menu z-50 flex shrink-0 items-center font-bold'>
      <Dropdown
        label={_('Menu')}
        className='exclude-title-bar-mousedown dropdown-bottom'
        buttonClassName='btn btn-ghost btn-xs'
        toggleButton={<Logo />}
      >
        <SettingsMenu />
      </Dropdown>
    </div>
  );
};

export const NavTab: React.FC = () => {
  const { appService } = useEnv();
  const { safeAreaInsets: insets } = useThemeStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { isFontLayoutSettingsDialogOpen } = useSettingsStore();
  
  const headerRef = useRef<HTMLDivElement>(null);
  const { isTrafficLightVisible } = useTrafficLight(headerRef);
  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  if (!insets) return null;

  return (
    <div
      ref={headerRef}
      className={clsx(
        'nav-tab bg-base-200 z-50 flex w-full items-center justify-end px-2',
        // Desktop keeps a slim bar for the window buttons / macOS traffic
        // lights; mobile and web have neither, so the bar collapses.
        appService?.hasWindowBar ? 'min-h-8 py-1' : 'h-0',
        windowButtonVisible ? 'sm:pr-4' : 'sm:pr-6',
      )}
      style={{
        marginTop: appService?.hasSafeAreaInset
          ? `max(${insets.top}px, ${systemUIVisible ? statusBarHeight : 0}px)`
          : '0px',
      }}
    >
      {appService?.hasWindowBar && (
        <WindowButtons
          headerRef={headerRef}
          showMinimize={windowButtonVisible}
          showMaximize={windowButtonVisible}
          showClose={windowButtonVisible}
        />
      )}
      <AboutWindow />
      <AuthWindow />
      <UpdaterWindow />
      <MigrateDataWindow />
      {isFontLayoutSettingsDialogOpen && <SettingsDialog bookKey={''} />}
      <KeyboardShortcutsHelp />
      <Toast />
    </div>
  );
};

export default function NavBar({ children }: { children: React.ReactNode }) {
  const _ = useTranslation();
  const { appService } = useEnv();
  const { isRoundedWindow } = useThemeStore();
  const { settings } = useSettingsStore();
  const viewSettings = settings.globalViewSettings;

  useEffect(() => {
    if (appService?.isMobileApp) {
      lockScreenOrientation({ orientation: 'auto' });
    }
  }, [appService]);

  useEffect(() => {
    const doCheckAppUpdates = async () => {
      if (appService?.hasUpdater && settings.autoCheckUpdates) {
        await checkForAppUpdates(_);
      } else if (appService?.hasUpdater === false) {
        checkAppReleaseNotes();
      }
    };
    if (settings.alwaysOnTop) {
      tauriHandleSetAlwaysOnTop(settings.alwaysOnTop);
    }
    doCheckAppUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appService?.hasUpdater, settings]);

  useScreenWakeLock(settings.screenWakeLock);

  useShortcuts({
    onToggleFullscreen: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleToggleFullScreen();
      }
    },
    onCloseWindow: async () => {
      if (isTauriAppPlatform()) {
        await tauriHandleClose();
      }
    },
    onQuitApp: async () => {
      if (isTauriAppPlatform()) {
        await tauriQuitApp();
      }
    },
  });

  return (
    <div 
      className={clsx(
        'nav-page full-height bg-base-200 text-base-content flex flex-col',
        viewSettings?.isEink ? 'bg-base-100' : 'bg-base-200',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div className='nav-bar'><NavTab /></div>
      {children}
    </div>
  );
}
