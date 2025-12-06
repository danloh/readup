'use client';

import clsx from 'clsx';
import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ImFeed } from "react-icons/im";
import { BiLibrary } from 'react-icons/bi';
import { SiProgress } from "react-icons/si";
import { MdOutlineSettings } from 'react-icons/md';
import { GrCatalog } from 'react-icons/gr';
import { useTranslation } from '@/hooks/useTranslation';
import { useTrafficLight } from '@/hooks/useTrafficLight';
import { useEnv } from '@/context/EnvContext';
import Dropdown from '@/components/Dropdown';
import { AboutWindow } from '@/components/AboutWindow';
import { AuthWindow } from '@/components/AuthWindow';
import { UpdaterWindow } from '@/components/UpdaterWindow';
import WindowButtons from '@/components/WindowButtons';
import { useThemeStore } from '@/store/themeStore';
import SettingsMenu from './SettingsMenu';
import { MigrateDataWindow } from './MigrateDataWindow';

function titleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase()
  );
}

export const NavTab: React.FC<{activeTab: string}> = ({ activeTab }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { appService } = useEnv();
  const headerRef = useRef<HTMLDivElement>(null);
  const { safeAreaInsets: insets } = useThemeStore();
  const { systemUIVisible, statusBarHeight } = useThemeStore();
  const { isTrafficLightVisible } = useTrafficLight();

  const windowButtonVisible = appService?.hasWindowBar && !isTrafficLightVisible;

  const tabs = appService?.appPlatform !== 'web' 
    ? ['library', 'feed', 'catalog', 'streak']
    : ['library', 'feed', 'catalog', 'streak'];

  if (!insets) return null;

  const onTabNav = useCallback((tab: string) => {
    router.push(`/${tab}`)
  }, [router]);

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
              onClick={() => onTabNav(tab)}
            >
              {tab === 'library' ? (
                <BiLibrary className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : tab === 'feed' ? (
                <ImFeed className={clsx('mx-auto', tab === activeTab && 'text-success')} />
              ) : tab === 'catalog' ? (
                <GrCatalog className={clsx('mx-auto', tab === activeTab && 'text-success')} />  
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
      <AuthWindow />
      <UpdaterWindow />
      <MigrateDataWindow />
    </div>
  );
};


export default function NavBar({ tab, children }: { tab: string; children: React.ReactNode }) {
  const { appService } = useEnv();
  const { isRoundedWindow } = useThemeStore();

  return (
    <div 
      className={clsx(
        'nav-page full-height bg-base-200 text-base-content flex select-none flex-col overflow-hidden',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div className='nav-bar'><NavTab activeTab={tab} /></div>
      {children}
    </div>
  );
}
