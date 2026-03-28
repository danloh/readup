'use client';

import clsx from 'clsx';
import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImFeed } from "react-icons/im";
import { BiLibrary } from 'react-icons/bi';
import { SiProgress } from "react-icons/si";
import { GrCatalog } from 'react-icons/gr';

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

function titleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

export const NavTab: React.FC<{activeTab: string}> = ({ activeTab }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { appService } = useEnv();
  const { safeAreaInsets: insets } = useThemeStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { isFontLayoutSettingsDialogOpen } = useSettingsStore();
  const { isTrafficLightVisible } = useTrafficLight();

  const headerRef = useRef<HTMLDivElement>(null);

  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const tabs = ['library', 'feed', 'catalog', 'streak'];

  if (!insets) return null;

  const onTabNav = useCallback((tab: string) => {
    router.push(`/${tab}`)
  }, [router]);

  return (
    <div
      ref={headerRef}
      className={clsx(
        'nav-tab bg-base-200 z-50 flex w-full items-center justify-between py-1 px-2',
        windowButtonVisible ? 'sm:pr-4' : 'sm:pr-6',
        isTrafficLightVisible ? 'pl-16' : 'pl-0 sm:pl-2',
      )}
      style={{
        marginTop: appService?.hasSafeAreaInset
          ? `max(${insets.top}px, ${systemUIVisible ? statusBarHeight : 0}px)`
          : appService?.hasTrafficLight
            ? '-2px'
            : '0px',
      }}
    >
      <div className='flex font-bold items-center z-50 justify-start mx-1 logo-menu'>
        <Dropdown
          label={_('Menu')}
          className='exclude-title-bar-mousedown dropdown-bottom'
          buttonClassName='btn btn-ghost btn-xs'
          toggleButton={<Logo />}
        >
          <SettingsMenu />
        </Dropdown>
      </div>
      <div className='flex flex-wrap w-full items-center justify-end gap-1'>
        {tabs.map((tab) => (
          <div
            key={tab}
            className='tooltip tooltip-bottom m-1 rounded-md z-50'
            data-tip={_(titleCase(tab))}
          >
            <button 
              type='button'
              className='btn btn-ghost btn-xs' 
              onClick={() => onTabNav(tab)}
            >
              {tab === 'library' ? (
                <BiLibrary 
                  size={18} 
                  className={clsx('mx-auto', tab === activeTab && 'text-success')} 
                />
              ) : tab === 'feed' ? (
                <ImFeed 
                  size={18} 
                  className={clsx('mx-auto', tab === activeTab && 'text-success')} 
                />
              ) : tab === 'catalog' ? (
                <GrCatalog 
                  size={18} 
                  className={clsx('mx-auto', tab === activeTab && 'text-success')} 
                />  
              ) : (
                <SiProgress 
                  size={18} 
                  className={clsx('mx-auto', tab === activeTab && 'text-success')} 
                />
              )}
            </button>
          </div>
        ))}
        {appService?.hasWindowBar && (
          <WindowButtons
            headerRef={headerRef}
            showMinimize={windowButtonVisible}
            showMaximize={windowButtonVisible}
            showClose={windowButtonVisible}
          />
        )}
      </div>
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

export default function NavBar({ tab, children }: { tab: string; children: React.ReactNode }) {
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
      <div className='nav-bar'><NavTab activeTab={tab} /></div>
      {children}
    </div>
  );
}
