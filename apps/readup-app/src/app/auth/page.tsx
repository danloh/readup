'use client';
import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IoArrowBack } from 'react-icons/io5';

import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { isTauriAppPlatform } from '@/services/environment';
import { onOpenUrl } from '@tauri-apps/plugin-deep-link';
import { start, cancel, onUrl, onInvalidUrl } from '@fabianlars/tauri-plugin-oauth';
import { handleAuthCallback } from '@/helpers/auth';
import WindowButtons from '@/components/WindowButtons';

interface SingleInstancePayload {
  args: string[];
  cwd: string;
}

export default function AuthPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  const { envConfig, appService } = useEnv();
  const { safeAreaInsets } = useThemeStore();
  const { isTrafficLightVisible } = useTrafficLightStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const [port, setPort] = useState<number | null>(null);
  const isOAuthServerRunning = useRef(false);
  const [isMounted, setIsMounted] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);

  useTheme({ systemUIVisible: false });

  const handleOAuthUrl = async (url: string) => {
    console.log('Handle OAuth URL:', url);
    const hashMatch = url.match(/#(.*)/);
    if (hashMatch) {
      const hash = hashMatch[1];
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');
      const next = params.get('next') ?? '/';
      if (accessToken) {
        handleAuthCallback({ accessToken, refreshToken, type, next, login, navigate: router.push });
      }
    }
  };

  const startTauriOAuth = async () => {
    try {
      if (process.env.NODE_ENV === 'production' || appService?.isMobileApp) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const currentWindow = getCurrentWindow();
        currentWindow.listen('single-instance', ({ event, payload }) => {
          console.log('Received deep link:', event, payload);
          const { args } = payload as SingleInstancePayload;
          if (args?.[1]) {
            handleOAuthUrl(args[1]);
          }
        });
        await onOpenUrl((urls) => {
          urls.forEach((url) => {
            handleOAuthUrl(url);
          });
        });
      } else {
        const port = await start();
        setPort(port);
        console.log(`OAuth server started on port ${port}`);

        await onUrl(handleOAuthUrl);
        await onInvalidUrl((url) => {
          console.log('Received invalid OAuth URL:', url);
        });
      }
    } catch (error) {
      console.error('Error starting OAuth server:', error);
    }
  };

  const stopTauriOAuth = async () => {
    try {
      if (port) {
        await cancel(port);
        console.log('OAuth server stopped');
      }
    } catch (error) {
      console.error('Error stopping OAuth server:', error);
    }
  };

  const handleGoBack = () => {
    // Keep login false to avoid infinite loop to redirect to the login page
    settings.keepLogin = false;
    setSettings(settings);
    saveSettings(envConfig, settings);
    router.back();
  };

  useEffect(() => {
    if (!isTauriAppPlatform()) return;
    if (isOAuthServerRunning.current) return;
    isOAuthServerRunning.current = true;

    startTauriOAuth();
    return () => {
      isOAuthServerRunning.current = false;
      stopTauriOAuth();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  // For tauri app development, use a custom OAuth server to handle the OAuth callback
  // For tauri app production, use deeplink to handle the OAuth callback
  // For web app, use the built-in OAuth callback page /auth/callback
  return isTauriAppPlatform() ? (
    <div
      className={clsx(
        'bg-base-100 inset-0 flex select-none flex-col items-center overflow-hidden',
        appService?.isIOSApp ? 'h-[100vh]' : 'h-dvh',
        appService?.isLinuxApp && 'window-border',
        appService?.hasRoundedWindow && 'rounded-window',
      )}
    >
       <div
        className={clsx('flex h-full w-full flex-col items-center overflow-y-auto')}
        style={{paddingTop: `${safeAreaInsets?.top || 0}px`}}
      >
        <div
          ref={headerRef}
          className={clsx(
            'fixed z-10 flex w-full items-center justify-between py-2 pe-6 ps-4',
            appService?.hasTrafficLight && 'pt-11',
          )}
        >
          <button onClick={handleGoBack} className={clsx('btn btn-ghost h-8 min-h-8 w-8 p-0')}>
            <IoArrowBack className='text-base-content' />
          </button>

          {appService?.hasWindowBar && (
            <WindowButtons
              headerRef={headerRef}
              showMinimize={!isTrafficLightVisible}
              showMaximize={!isTrafficLightVisible}
              showClose={!isTrafficLightVisible}
              onClose={handleGoBack}
            />
          )}
        </div>
        <div
          className={clsx('z-20 pb-8', appService?.hasTrafficLight ? 'mt-24' : 'mt-12')}
          style={{ maxWidth: '420px' }}
        >
          <hr className='border-base-300 my-3 mt-6 w-64 border-t' />
          {/* TODO: Auth */}
        </div>
      </div>
    </div>
  ) : (
    <div style={{ maxWidth: '420px', margin: 'auto', padding: '2rem', paddingTop: '4rem' }}>
      <button
        onClick={handleGoBack}
        className='btn btn-ghost fixed left-6 top-6 h-8 min-h-8 w-8 p-0'
      >
        <IoArrowBack className='text-base-content' />
      </button>
      {/* TODO: Auth */}
    </div>
  );
}
