import { useEnv } from '@/context/EnvContext';
import { saveSysSettings } from '@/helpers/settings';
import { useSettingsStore } from '@/store/settingsStore';
import { useSidebarStore } from '@/store/sidebarStore';
import { useEffect } from 'react';

const useSidebar = (initialWidth: string, isPinned: boolean) => {
  const { envConfig } = useEnv();
  const { settings } = useSettingsStore();
  const {
    sideBarWidth,
    isSideBarVisible,
    isSideBarPinned,
    
    setSideBarWidth,
    setSideBarVisible,
    setSideBarPin,
    toggleSideBar,
    toggleSideBarPin,
  } = useSidebarStore();

  useEffect(() => {
    setSideBarWidth(initialWidth);
    setSideBarPin(isPinned);
    setSideBarVisible(isPinned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSideBarResize = (newWidth: string) => {
    setSideBarWidth(newWidth);
    settings.globalReadSettings.sideBarWidth = newWidth;
  };

  const handleSideBarTogglePin = () => {
    toggleSideBarPin();
    if (isSideBarPinned && isSideBarVisible) setSideBarVisible(false);
    const globalReadSettings = settings.globalReadSettings;
    const newGlobalReadSettings = { ...globalReadSettings, isSideBarPinned: !isSideBarPinned };
    saveSysSettings(envConfig, 'globalReadSettings', newGlobalReadSettings);
  };

  return {
    sideBarWidth,
    isSideBarPinned,
    isSideBarVisible,
    handleSideBarResize,
    handleSideBarTogglePin,
    setSideBarVisible,
    toggleSideBar,
  };
};

export default useSidebar;
