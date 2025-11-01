'use client';

import '@/utils/polyfill';
import i18n from '@/i18n/i18n';
import { useEffect } from 'react';
import { IconContext } from 'react-icons';
import { AuthProvider } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { CSPostHogProvider } from '@/context/PHContext';
import { SyncProvider } from '@/context/SyncContext';
import { useDefaultIconSize } from '@/hooks/useResponsiveSize';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { initSystemThemeListener, useThemeStore } from '@/store/themeStore';
import { getDirFromUILanguage } from '@/utils/rtl';
import { getLocale } from '@/utils/misc';

const Providers = ({ children }: { children: React.ReactNode }) => {
  const { appService } = useEnv();
  const { uiLang, setUILang } = useThemeStore();
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
    if (appService) {
      initSystemThemeListener(appService);
      setUILang(uiLang); // init ui lang 
    }
  }, [appService]);

  // Make sure appService is available in all children components
  if (!appService) return;

  return (
    <CSPostHogProvider>
      <AuthProvider>
        <IconContext.Provider value={{ size: `${iconSize}px` }}>
          <SyncProvider>{children}</SyncProvider>
        </IconContext.Provider>
      </AuthProvider>
    </CSPostHogProvider>
  );
};

export default Providers;
