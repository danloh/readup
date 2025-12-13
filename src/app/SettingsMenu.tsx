import clsx from 'clsx';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiUserCircle } from 'react-icons/pi';
import { MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md';
import { GrSystem } from "react-icons/gr";
import { BiData, BiMoon, BiSun } from 'react-icons/bi';
import { AiOutlineFullscreen } from 'react-icons/ai';
import { RxReload } from 'react-icons/rx';
import { IoCloudDownloadOutline } from 'react-icons/io5';
import { FaInfo } from 'react-icons/fa';
import { invoke, PermissionState } from '@tauri-apps/api/core';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { setAuthDialogVisible } from '@/components/AuthWindow';
// import UserAvatar from '@/components/UserAvatar';
import Menu from '@/components/Menu';
import MenuItem from '@/components/MenuItem';
import { LangSelect } from '@/components/Select';
import { isTauriAppPlatform, isWebAppPlatform } from '@/services/environment';
import { DOWNLOAD_READUP_URL } from '@/services/constants';
import { useAuth } from '@/context/AuthContext';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { navigateToProfile } from '@/utils/nav';
import { tauriHandleSetAlwaysOnTop, tauriHandleToggleFullScreen } from '@/utils/window';
import { optInTelemetry, optOutTelemetry } from '@/utils/telemetry';
import { saveSysSettings } from '@/helpers/settings';
import { setMigrateDataDirDialogVisible } from './MigrateDataWindow';

interface SettingsMenuProps {
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

interface Permissions {
  postNotification: PermissionState;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ setIsDropdownOpen }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { user } = useAuth();
  const { themeMode, setThemeMode } = useThemeStore();
  const { settings } = useSettingsStore();
  const [isAutoCheckUpdates, setIsAutoCheckUpdates] = useState(settings.autoCheckUpdates);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(settings.alwaysOnTop);
  const [isAlwaysShowStatusBar, setIsAlwaysShowStatusBar] = useState(settings.alwaysShowStatusBar);
  const [isScreenWakeLock, setIsScreenWakeLock] = useState(settings.screenWakeLock);
  const [isOpenLastBooks, setIsOpenLastBooks] = useState(settings.openLastBooks);
  const [isAutoImportBooksOnOpen, setIsAutoImportBooksOnOpen] = useState(
    settings.autoImportBooksOnOpen,
  );
  const [isTelemetryEnabled, setIsTelemetryEnabled] = useState(settings.telemetryEnabled);
  const [alwaysInForeground, setAlwaysInForeground] = useState(settings.alwaysInForeground);

  const showAboutReadup = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const showAuthWindow = () => {
    setAuthDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const downloadReadup = () => {
    window.open(DOWNLOAD_READUP_URL, '_blank');
    setIsDropdownOpen?.(false);
  };

  const handleUserProfile = () => {
    navigateToProfile(router);
    setIsDropdownOpen?.(false);
  };

  const cycleThemeMode = () => {
    const nextMode = themeMode === 'auto' ? 'light' : themeMode === 'light' ? 'dark' : 'auto';
    setThemeMode(nextMode);
  };

  const handleReloadPage = () => {
    window.location.reload();
    setIsDropdownOpen?.(false);
  };

  const handleFullScreen = () => {
    tauriHandleToggleFullScreen();
    setIsDropdownOpen?.(false);
  };

  const toggleOpenInNewWindow = async () => {
    await saveSysSettings(envConfig, 'openBookInNewWindow', !settings.openBookInNewWindow);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysOnTop = async () => {
    const newValue = !settings.alwaysOnTop;
    await saveSysSettings(envConfig, 'alwaysOnTop', newValue);
    setIsAlwaysOnTop(newValue);
    tauriHandleSetAlwaysOnTop(newValue);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysShowStatusBar = async () => {
    const newValue = !settings.alwaysShowStatusBar;
    await saveSysSettings(envConfig, 'alwaysShowStatusBar', newValue);
    setIsAlwaysShowStatusBar(newValue);
  };

  const toggleAutoImportBooksOnOpen = async () => {
    const newValue = !settings.autoImportBooksOnOpen;
    await saveSysSettings(envConfig, 'autoImportBooksOnOpen', newValue);
    setIsAutoImportBooksOnOpen(newValue);
  };

  const toggleAutoCheckUpdates = async () => {
    const newValue = !settings.autoCheckUpdates;
    await saveSysSettings(envConfig, 'autoCheckUpdates', newValue);
    setIsAutoCheckUpdates(newValue);
  };

  const toggleScreenWakeLock = async () => {
    const newValue = !settings.screenWakeLock;
    await saveSysSettings(envConfig, 'screenWakeLock', newValue);
    setIsScreenWakeLock(newValue);
  };

  const toggleOpenLastBooks = async () => {
    const newValue = !settings.openLastBooks;
    await saveSysSettings(envConfig, 'openLastBooks', newValue);
    setIsOpenLastBooks(newValue);
  };

  const toggleTelemetry = async () => {
    const newValue = !settings.telemetryEnabled;
    await saveSysSettings(envConfig, 'telemetryEnabled', newValue);
    setIsTelemetryEnabled(newValue);
    if (newValue) {
      optInTelemetry();
    } else {
      optOutTelemetry();
    }
  };

  const handleSetRootDir = () => {
    setMigrateDataDirDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysInForeground = async () => {
    const requestAlwaysInForeground = !settings.alwaysInForeground;

    if (requestAlwaysInForeground) {
      let permission = await invoke<Permissions>('plugin:native-tts|checkPermissions');
      if (permission.postNotification !== 'granted') {
        permission = await invoke<Permissions>('plugin:native-tts|requestPermissions', {
          permissions: ['postNotification'],
        });
      }
      if (permission.postNotification !== 'granted') return;
    }

    await saveSysSettings(envConfig, 'alwaysInForeground', requestAlwaysInForeground);
    setAlwaysInForeground(requestAlwaysInForeground);
  };

  return (
    <Menu
      label={_('Settings Menu')}
      className={clsx(
        'settings-menu dropdown-content no-triangle border-base-100',
        'z-20 mt-2 max-w-[90vw] shadow-2xl',
      )}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      {user ? (
        <MenuItem label={_('Account')} Icon={PiUserCircle} onClick={handleUserProfile} />
      ) : (
        <MenuItem label={_('Sign In')} Icon={PiUserCircle} onClick={showAuthWindow}></MenuItem>
      )}
      <MenuItem
        label={
          themeMode === 'dark'
            ? _('Dark Mode')
            : themeMode === 'light'
              ? _('Light Mode')
              : _('Auto Mode')
        }
        Icon={themeMode === 'dark' ? BiMoon : themeMode === 'light' ? BiSun : GrSystem}
        onClick={cycleThemeMode}
      />
      {appService?.canCustomizeRootDir && (
        <>
          <hr aria-hidden='true' className='border-base-200 my-1' />
          <MenuItem 
            label={_('Change Data Location')} 
            Icon={BiData} 
            onClick={handleSetRootDir} 
          />
        </>
      )}
      <hr className='border-base-200 my-1' />
      {appService?.hasWindow && (
        <MenuItem 
          label={_('Fullscreen')} 
          Icon={AiOutlineFullscreen}
          onClick={handleFullScreen} 
        />
      )}
      {appService?.hasWindow && (
        <MenuItem
          label={_('Open Book in New Window')}
          Icon={settings.openBookInNewWindow ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleOpenInNewWindow}
        />
      )}
      {isTauriAppPlatform() && (
        <MenuItem
          label={_('Open Last Book on Start')}
          Icon={isOpenLastBooks ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleOpenLastBooks}
        />
      )}
      {isTauriAppPlatform() && !appService?.isMobile && (
        <MenuItem
          label={_('Auto Import on File Open')}
          Icon={isAutoImportBooksOnOpen ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleAutoImportBooksOnOpen}
        />
      )}
      {appService?.hasWindow && (
        <MenuItem
          label={_('Always on Top')}
          Icon={isAlwaysOnTop ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleAlwaysOnTop}
        />
      )}
      {appService?.isMobileApp && (
        <MenuItem
          label={_('Always Show Status Bar')}
          Icon={isAlwaysShowStatusBar ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleAlwaysShowStatusBar}
        />
      )}
      {appService?.isAndroidApp && (
        <MenuItem
          label={_(_('Background Read Aloud'))}
          Icon={alwaysInForeground ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleAlwaysInForeground}
        />
      )}
      <MenuItem
        label={_('Keep Screen Awake')}
        Icon={isScreenWakeLock ? MdCheckBox : MdCheckBoxOutlineBlank}
        onClick={toggleScreenWakeLock}
      />
      <MenuItem 
        label={_('Reload Page')} 
        Icon={RxReload}
        onClick={handleReloadPage} 
      />
      <hr className='border-base-200 my-1' />
      <MenuItem
        label={_('Help improve Readup')}
        description={isTelemetryEnabled ? _('Sharing anonymized statistics') : ''}
        Icon={isTelemetryEnabled ? MdCheckBox : MdCheckBoxOutlineBlank}
        onClick={toggleTelemetry}
      />
      {isWebAppPlatform() && (
        <MenuItem 
          label={_('Download Readup')} 
          Icon={IoCloudDownloadOutline}
          onClick={downloadReadup} 
        />
      )}
      {appService?.hasUpdater && (
        <MenuItem
          label={_('Check Updates on Start')}
          Icon={isAutoCheckUpdates ? MdCheckBox : MdCheckBoxOutlineBlank}
          onClick={toggleAutoCheckUpdates}
        />
      )}
      <MenuItem 
        label={_('About Readup')} 
        Icon={FaInfo}
        onClick={showAboutReadup} 
      />
      <hr className='border-base-200 my-1' />
      <div className='flex items-end justify-between'>  
        <LangSelect />
      </div>
    </Menu>
  );
};

export default SettingsMenu;
