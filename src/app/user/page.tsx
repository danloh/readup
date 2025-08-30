'use client';

import clsx from 'clsx';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useThemeStore } from '@/store/themeStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { navigateToLibrary } from '@/utils/nav';
import { deleteUser } from '@/libs/user';
import { eventDispatcher } from '@/utils/event';

import { Toast } from '@/components/Toast';
import ProfileHeader from './components/Header';
import UserInfo from './components/UserInfo';
import AccountActions from './components/AccountActions';

const ProfilePage = () => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { token, user, logout } = useAuth();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { safeAreaInsets } = useThemeStore();
  const [showEmbeddedCheckout, setShowEmbeddedCheckout] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useTheme({ systemUIVisible: false });

  const handleGoBack = () => {
    if (showEmbeddedCheckout) {
      setShowEmbeddedCheckout(false);
    } else {
      navigateToLibrary(router);
    }
  };

  const handleLogout = () => {
    logout();
    settings.keepLogin = false;
    setSettings(settings);
    saveSettings(envConfig, settings);
    navigateToLibrary(router);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteUser();
      handleLogout();
    } catch (error) {
      console.error('Error deleting user:', error);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: _('Failed to delete user. Please try again later.'),
      });
    }
  };

  if (!mounted) {
    return null;
  }

  if (!user || !token || !appService) {
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

  const avatarUrl = user?.user_metadata?.['picture'] || user?.user_metadata?.['avatar_url'];
  const userFullName = user?.user_metadata?.['full_name'] || '-';
  const userEmail = user?.email || '';

  return (
    <div
      className={clsx(
        'bg-base-100 inset-0 select-none overflow-hidden',
        appService?.isIOSApp ? 'h-[100vh]' : 'h-dvh',
        appService?.isLinuxApp && 'window-border',
        appService?.hasRoundedWindow && 'rounded-window',
      )}
    >
      <div
        className={clsx('flex h-full w-full flex-col items-center overflow-y-auto')}
        style={{paddingTop: `${safeAreaInsets?.top || 0}px`}}
      >
        <ProfileHeader onGoBack={handleGoBack} />
        <div className='w-full min-w-60 max-w-4xl py-10'>
          {showEmbeddedCheckout ? (
            <div className='bg-base-100 rounded-lg p-4'>
              TODO
            </div>
          ) : (
            <div className='sm:bg-base-200 overflow-hidden rounded-lg sm:p-6 sm:shadow-md'>
              <div className='flex flex-col gap-y-8'>
                <div className='flex flex-col gap-y-8 px-6'>
                  <UserInfo
                    avatarUrl={avatarUrl}
                    userFullName={userFullName}
                    userEmail={userEmail}
                    
                  />
                </div>

                <div className='flex flex-col gap-y-8 px-6'>
                  <AccountActions
                    onLogout={handleLogout}
                    onConfirmDelete={handleConfirmDelete}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <Toast />
      </div>
    </div>
  );
};

export default ProfilePage;
