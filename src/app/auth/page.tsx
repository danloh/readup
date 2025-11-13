'use client';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
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
import WindowButtons from '@/components/WindowButtons';


export default function AuthPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { login } = useAuth();
  //const { envConfig, appService } = useEnv();
  const { safeAreaInsets } = useThemeStore();
  const { isTrafficLightVisible } = useTrafficLightStore();

  useTheme({ systemUIVisible: false });

  const [host, setHost] = useState('');
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');

  const onSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      // TODO      
    },
    [handle, password]
  );

  
  return (
    <div style={{ maxWidth: '420px', margin: 'auto', padding: '2rem', paddingTop: '4rem' }}>
      <div className="card mx-auto py-8 px-4 w-full mx-auto max-w-md">
        <h1 className="title text-center text-2xl mb-4">Welcome to Readup</h1>
        <form
          className="flex flex-col gap-4" 
          onSubmit={onSubmit}
        >
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Service</span> 
            <input
              type="text"
              name="host"
              id="host" 
              placeholder="such as: bsky.social"
              value="bsky.social" 
              onChange={(event) => setPassword(event.target.value)}
              className="grow" 
            />
          </label>
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Handle</span>
            <input
              type="text"
              name="handle"
              id="handle" 
              placeholder="e.g. my.bsky.social"
              className="grow" 
              onChange={(event) => setHost(event.target.value)}
              required
            />
          </label>
          <label className="w-full input flex items-center gap-2">
            <span className="text-accent">Password</span>
            <input
              type="password"
              name="pass"
              id="pass" 
              className="grow" 
              placeholder="App Password" 
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <a 
            className="text-sm text-success" 
            href="https://bsky.app/settings/app-passwords" 
            target="_blank"
          >
            Go to generate the app password
          </a>
          <button type="submit" className="btn btn-neutral" >
            Log In
          </button>
        </form>
      </div>
    </div>
  );
}
