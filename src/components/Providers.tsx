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
import { initSystemThemeListener, loadDataTheme, useThemeStore } from '@/store/themeStore';
import { getDirFromUILanguage } from '@/utils/rtl';
import { getLocale } from '@/utils/misc';
import { CommandPalette, CommandPaletteProvider } from './command-palette';

const Providers = ({ children }: { children: React.ReactNode }) => {
  const { appService } = useEnv();
  const { uiLang, setUILang } = useThemeStore();
  const { applyEinkMode } = useEinkMode();
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
      });
    }
  }, [appService]);

  // Make sure appService is available in all children components
  if (!appService) return;

  return (
    <CSPostHogProvider>
      <AuthProvider>
        <IconContext.Provider value={{ size: `${iconSize}px` }}>
          <DropdownProvider>
            <CommandPaletteProvider>
              {children}
              <CommandPalette />
            </CommandPaletteProvider>
          </DropdownProvider>
        </IconContext.Provider>
      </AuthProvider>
    </CSPostHogProvider>
  );
};

export default Providers;
