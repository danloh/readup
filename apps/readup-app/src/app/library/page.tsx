'use client';

import clsx from 'clsx';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { ImFeed } from "react-icons/im";
import { BiLibrary } from 'react-icons/bi';
import { SiProgress } from "react-icons/si";
import { useTranslation } from '@/hooks/useTranslation';
import CatalogPage from './components/CatalogPage';
import LibraryPage from './components/LibraryPage';
import StreakPage from './components/StreakPage';
import { useEnv } from '@/context/EnvContext';
import WindowButtons from '@/components/WindowButtons';
import { useTrafficLightStore } from '@/store/trafficLightStore';
import { useSafeAreaInsets } from '@/hooks/useSafeAreaInsets';
import { useThemeStore } from '@/store/themeStore';

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
      <div className='nav-tab'>
        <NavTab activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      {activeTab === 'library' ? (
        <LibraryPage />
      ) : activeTab === 'catalog' ? (
        <CatalogPage />
      ) : (
        <StreakPage />
      )}
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

  const tabs = ['library', 'catalog', 'streak'];

  if (!insets) return null;

  return (
    <div
      ref={headerRef}
      className={clsx(
        'navbar bg-base-200 z-10 flex w-full items-center py-2 pr-2',
        isTrafficLightVisible ? 'pl-16' : 'pl-2',
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
      {tabs.map((tab) => (
        <div
          key={tab}
          className='tooltip tooltip-bottom z-50 m-1 flex-1 cursor-pointer rounded-md p-2 hover:bg-base-300'
          data-tip={
            tab === 'library' ? _('Library') : tab === 'catalog' ? _('Catalog') : _('Streak')
          }
        >
          <div className='flex h-6 items-center' onClick={() => onTabChange(tab)}>
            {tab === 'library' ? (
              <BiLibrary className={clsx('mx-auto', tab === activeTab && 'text-success')} />
            ) : tab === 'catalog' ? (
              <ImFeed className={clsx('mx-auto', tab === activeTab && 'text-success')} />
            ) : (
              <SiProgress className={clsx('mx-auto', tab === activeTab && 'text-success')} />
            )}
          </div>
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
  );
};

export default Library;
