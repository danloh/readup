'use client';

import '@/utils/polyfill';
import i18n from '@/i18n/i18n';
import { useEffect } from 'react';
import { IconContext } from 'react-icons';
import { AuthProvider } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { DropdownProvider } from '@/context/DropdownContext';
import { useDefaultIconSize } from '@/hooks/useResponsiveSize';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useEinkMode } from '@/hooks/useEinkMode';
import { getAndroidPatchedViewportContent } from '@/utils/viewport';
import { getDirFromUILanguage } from '@/utils/rtl';
import { getLocale } from '@/utils/misc';
import { initSystemThemeListener, loadDataTheme, useThemeStore } from '@/store/themeStore';
import { useAppLockStore } from '@/store/appLockStore';
import { CommandPalette, CommandPaletteProvider } from './command-palette';
import AppLockDialog from './settings/AppLockDialog';
import AppLockScreen from './AppLockScreen';

const Providers = ({ children }: { children: React.ReactNode }) => {
  const { appService } = useEnv();
  const { uiLang, setUILang } = useThemeStore();
  const { applyEinkMode } = useEinkMode();

  const {
    isInitialized: isLockInitialized,
    isUnlocked,
    initialize: initializeAppLock,
  } = useAppLockStore();
  
  const iconSize = useDefaultIconSize();
  useSafeAreaInsets(); // Initialize safe area insets

  useEffect(() => {
    const handlerLanguageChanged = (lng: string) => {
      document.documentElement.lang = lng;
      // Set RTL class on document for targeted styling without affecting layout
      const dir = getDirFromUILanguage();
      if (dir === 'rtl') {
        document.documentElement.classList.add('ui-rtl');
      } else {
        document.documentElement.classList.remove('ui-rtl');
      }
    };

    const locale = getLocale();
    handlerLanguageChanged(locale);
    i18n.on('languageChanged', handlerLanguageChanged);
    return () => {
      i18n.off('languageChanged', handlerLanguageChanged);
    };
  }, []);

  useEffect(() => {
    loadDataTheme();
    if (appService) {
      initSystemThemeListener(appService);
      setUILang(uiLang); // init ui lang 
      appService.loadSettings().then((settings) => {
        const globalViewSettings = settings.globalViewSettings;
        if (globalViewSettings.isEink) {
          applyEinkMode(true);
        }
        // Initialize the app-lock gate from on-disk settings. Until
        // this runs, the gate renders nothing — guarantees the
        // library can't flash on screen before the lock screen does.
        initializeAppLock({
          enabled: !!settings.pinCodeEnabled,
          hash: settings.pinCodeHash,
          salt: settings.pinCodeSalt,
        });
      });
    }
  }, [appService, applyEinkMode, initializeAppLock]);

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const updated = getAndroidPatchedViewportContent(navigator.userAgent, meta.content);
    if (updated) meta.content = updated;
  }, []);

  // Make sure appService is available in all children components
  if (!appService) return;

  // App-lock gate. While the lock store is uninitialized we render
  // nothing — without this guard the library would flash on screen
  // for a few hundred ms before `loadSettings` resolved and let the
  // lock store decide whether to lock.
  const showAppLockScreen = isLockInitialized && !isUnlocked;
  const appShellHidden = !isLockInitialized || !isUnlocked;

  return (
    <CSPostHogProvider>
      <AuthProvider>
        <IconContext.Provider value={{ size: `${iconSize}px` }}>
          <DropdownProvider>
            <CommandPaletteProvider>
              <div
                aria-hidden={appShellHidden}
                style={appShellHidden ? { display: 'none' } : undefined}
              >
                {children}
                <CommandPalette />
              </div>
              <AppLockDialog />
              {showAppLockScreen && <AppLockScreen />}
            </CommandPaletteProvider>
          </DropdownProvider>
        </IconContext.Provider>
      </AuthProvider>
    </CSPostHogProvider>
  );
};

export default Providers;
