'use client';

import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ImFeed } from "react-icons/im";
import { BiLibrary } from 'react-icons/bi';
import { SiProgress } from "react-icons/si";
import { MdOutlineSettings } from 'react-icons/md';
import { useTranslation } from '@/hooks/useTranslation';
import { useEnv } from '@/context/EnvContext';
import Dropdown from '@/components/Dropdown';
import { AboutWindow } from '@/components/AboutWindow';
import { UpdaterWindow } from '@/components/UpdaterWindow';
import WindowButtons from '@/components/WindowButtons';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useThemeStore } from '@/store/themeStore';
import LibraryPage from './components/LibraryPage';
import StreakPage from './components/StreakPage';
import CatalogPage from './components/feed/CatalogPage';
import SettingsMenu from './components/SettingsMenu';

const Library = () => {
  const { appService } = useEnv();
  const [activeTab, setActiveTab] = useState('library');
  return (
    <div 
      className={clsx(
        'nav-page bg-base-200 text-base-content flex select-none flex-col overflow-hidden',
        appService?.isIOSApp ? 'h-[100vh]' : 'h-dvh',
        appService?.isLinuxApp && 'window-border',
        appService?.hasRoundedWindow && 'rounded-window',
      )}
    >
      <div className='nav-bar'>
        <NavTab activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      {activeTab === 'library' ? (
        <LibraryPage />
      ) : activeTab === 'streak' ? (
        <StreakPage />
      ) : activeTab === 'catalog' && appService?.appPlatform !== 'web' ? (
        <CatalogPage />
      ) : null}
    </div>
  );
};

const NavTab: React.FC<{
  activeTab: string;
  onTabChange: (tab: string) => void;
}> = ({ activeTab, onTabChange }) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const headerRef = useRef<HTMLDivElement>(null);
  const insets = useSafeAreaInsets();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const {
    isTrafficLightVisible,
    initializeTrafficLightStore,
    initializeTrafficLightListeners,
    setTrafficLightVisibility,
    cleanupTrafficLightListeners,
  } = useTrafficLightStore();

  useEffect(() => {
    if (!appService?.hasTrafficLight) return;

    initializeTrafficLightStore(appService);
    initializeTrafficLightListeners();
    setTrafficLightVisibility(true);
    return () => {
      cleanupTrafficLightListeners();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const tabs = appService?.appPlatform === 'web' 
    ? ['library', 'streak']
    : ['library', 'catalog', 'streak'];

  if (!insets) return null;

  return (
    <div
      ref={headerRef}
      className={clsx(
        'nav-tab bg-base-200 z-50 flex w-full items-center justify-between py-1 px-2'
      )}
      style={{
        marginTop: appService?.hasSafeAreaInset
          ? `max(${insets.top}px, ${systemUIVisible ? statusBarHeight : 0}px)`
          : '0px',
      }}
    >
      <div className='flex text-xl font-bold items-start mx-1'>
        {'Readup'}
      </div>
      <div className='flex flex-wrap w-full items-center justify-end gap-1'>
        {tabs.map((tab) => (
          <div
            key={tab}
            className='tooltip tooltip-bottom m-1 rounded-md p-1 z-50'
            data-tip={
              tab === 'library' ? _('Library') : tab === 'catalog' ? _('Catalog') : _('Streak')
            }
          >
            <button 
              type='button'
              className='btn btn-ghost' 
              onClick={() => onTabChange(tab)}
            >
              {tab === 'library' ? (
                <BiLibrary className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : tab === 'catalog' ? (
                <ImFeed className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : (
                <SiProgress className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              )}
            </button>
          </div>
        ))}
        <Dropdown
          className='exclude-title-bar-mousedown dropdown-bottom dropdown-end z-50'
          buttonClassName='btn btn-ghost'
          toggleButton={<MdOutlineSettings />}
        >
          <SettingsMenu />
        </Dropdown>
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
      <UpdaterWindow />
    </div>
  );
};

export default Library;
