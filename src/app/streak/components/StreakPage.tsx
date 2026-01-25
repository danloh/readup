'use client';

import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
// import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
//import { useSettingsStore } from '@/store/settingsStore';
//import { navigateToLibrary } from '@/utils/nav';
import UserInfo from './UserInfo';

const StreakPage = () => {
  const _ = useTranslation();
  //const router = useRouter();
  const { appService } = useEnv();
  // const { user, logout } = useAuth();
  // const { settings, setSettings, saveSettings } = useSettingsStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useTheme({ systemUIVisible: false });

  // const handleLogout = () => {
  //   logout();
  //   settings.keepLogin = false;
  //   setSettings(settings);
  //   saveSettings(envConfig, settings);
  //   navigateToLibrary(router);
  // };

  if (!mounted) {
    return null;
  }

  if (!appService) {
    return (
      <div className='mx-auto max-w-4xl px-4 py-8'>
        <div className='overflow-hidden rounded-lg shadow-md'>
          <div className='flex min-h-[300px] items-center justify-center p-6'>
            <div className='text-base-content animate-pulse'>{_('Loading profile...')}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='feed-view flex flex-row overflow-y-auto h-full border-t-2 border-base-100'>
      <div className={clsx('flex h-full w-full flex-col items-center overflow-y-auto')}>
        <div className='w-full min-w-60 max-w-4xl py-10'>
          <div className='sm:bg-base-200 overflow-hidden rounded-lg sm:p-6 sm:shadow-md'>
            <div className='flex flex-col gap-y-8'>
              <div className='flex flex-col gap-y-8 px-6'>
                <UserInfo
                  avatarUrl={'avatarUrl'}
                  userFullName={'userFullName'}
                  userEmail={'userEmail'}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakPage;
