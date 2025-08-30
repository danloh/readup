'use client';

import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ImFeed } from "react-icons/im";
import { BiLibrary } from 'react-icons/bi';
import { SiProgress } from "react-icons/si";
import { MdOutlineSettings } from 'react-icons/md';
import { PiNotebook } from 'react-icons/pi';
import { useTranslation } from '@/hooks/useTranslation';
import { useEnv } from '@/context/EnvContext';
import Dropdown from '@/components/Dropdown';
import { AboutWindow } from '@/components/AboutWindow';
import { UpdaterWindow } from '@/components/UpdaterWindow';
import WindowButtons from '@/components/WindowButtons';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useThemeStore } from '@/store/themeStore';
import LibraryPage from './book/LibraryPage';
import SettingsMenu from './book/SettingsMenu';
import CatalogPage from './feed/CatalogPage';
import NotePage from './note/NotePage';
import StreakPage from './streak/StreakPage';

function titleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

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
      ) : activeTab === 'note' ? (
        <NotePage />
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
  const { safeAreaInsets: insets } = useThemeStore();
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
  }, [appService?.hasTrafficLight]);
  
  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const tabs = appService?.appPlatform === 'web' 
    ? ['library', 'note', 'streak']
    : ['library', 'catalog', 'note', 'streak'];

  if (!insets) return null;

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
          : '0px',
      }}
    >
      <div className='flex font-bold items-center justify-start mx-1'>
        {_(titleCase(activeTab))}
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
              className='btn btn-ghost btn-sm' 
              onClick={() => onTabChange(tab)}
            >
              {tab === 'library' ? (
                <BiLibrary className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : tab === 'catalog' ? (
                <ImFeed className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : tab === 'note' ? (
                <PiNotebook className={clsx('mx-auto', tab === activeTab && 'text-success')} />  
              ) : (
                <SiProgress className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              )}
            </button>
          </div>
        ))}
        <Dropdown
          className='exclude-title-bar-mousedown dropdown-bottom dropdown-end z-50'
          buttonClassName='btn btn-ghost btn-sm'
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
