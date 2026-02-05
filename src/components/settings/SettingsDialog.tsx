import clsx from 'clsx';
import React, { useEffect, useRef, useState } from 'react';
import { RiFontSize } from 'react-icons/ri';
import { VscSymbolColor } from 'react-icons/vsc';
import { PiDotsThreeVerticalBold, PiRobot } from 'react-icons/pi';
import { MdClose } from 'react-icons/md';
import { FaLanguage } from "react-icons/fa";
import { BiCustomize, BiLayout } from "react-icons/bi";
import { GiClick } from "react-icons/gi";
import { FiSearch } from 'react-icons/fi';

import { useEnv } from '@/context/EnvContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import Dropdown from '@/components/Dropdown';
import Dialog from '@/components/Dialog';
import { getCommandPaletteShortcut } from '@/services/environment';
import FontPanel from './FontPanel';
import LayoutPanel from './LayoutPanel';
import ColorPanel from './ColorPanel';
import DialogMenu from './DialogMenu';
import ControlPanel from './ControlPanel';
import LangPanel from './LangPanel';
import MiscPanel from './MiscPanel';
import AIPanel from './AIPanel';
import { useCommandPalette } from '../command-palette';

export type SettingsPanelType = 
  'Font' | 'Layout' | 'Color' | 'Control' | 'Language' | 'AI' | 'Custom';
export type SettingsPanelPanelProp = {
  bookKey: string;
  onRegisterReset: (resetFn: () => void) => void;
};

type TabConfig = {
  tab: SettingsPanelType;
  icon: React.ElementType;
  label: string;
  disabled?: boolean;
};

const SettingsDialog: React.FC<{ bookKey: string }> = ({ bookKey }) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { setFontLayoutSettingsDialogOpen, activeSettingsItemId, setActiveSettingsItemId } = 
    useSettingsStore();
  
  const { open: openCommandPalette } = useCommandPalette();

  const handleOpenCommandPalette = () => {
    openCommandPalette();
    // setFontLayoutSettingsDialogOpen(false);
  };

  const tabConfig = [
    {
      tab: 'Font',
      icon: RiFontSize,
      label: _('Font'),
    },
    {
      tab: 'Color',
      icon: VscSymbolColor,
      label: _('Color'),
    },
    {
      tab: 'Layout',
      icon: BiLayout,
      label: _('Layout'),
    },
    {
      tab: 'Control',
      icon: GiClick,
      label: _('Behavior'),
    },
    {
      tab: 'Language',
      icon: FaLanguage,
      label: _('Language'),
    },
    {
      tab: 'AI',
      icon: PiRobot,
      label: _('AI Assistant'),
      disabled: process.env.NODE_ENV === 'production',
    },
    {
      tab: 'Custom',
      icon: BiCustomize,
      label: _('Custom'),
    },
  ] as TabConfig[];

  const [activePanel, setActivePanel] = useState<SettingsPanelType>(() => {
    const lastPanel = localStorage.getItem('lastConfigPanel');
    if (lastPanel && tabConfig.some((tab) => tab.tab === lastPanel)) {
      return lastPanel as SettingsPanelType;
    }
    return 'Font' as SettingsPanelType;
  });

  const handleSetActivePanel = (tab: SettingsPanelType) => {
    setActivePanel(tab);
    localStorage.setItem('lastConfigPanel', tab);
  };

  // sync localStorage and fontPanelView when activePanel changes
  const activePanelRef = useRef(activePanel);
  useEffect(() => {
    if (activePanelRef.current !== activePanel) {
      activePanelRef.current = activePanel;
      localStorage.setItem('lastConfigPanel', activePanel);
    }
  }, [activePanel]);

  const [resetFunctions, setResetFunctions] = useState<
    Record<SettingsPanelType, (() => void) | null>
  >({
    Font: null,
    Layout: null,
    Color: null,
    Control: null,
    Language: null,
    AI: null,
    Custom: null,
  });

  const registerResetFunction = (panel: SettingsPanelType, resetFn: () => void) => {
    setResetFunctions((prev) => ({ ...prev, [panel]: resetFn }));
  };

  const handleResetCurrentPanel = () => {
    const resetFn = resetFunctions[activePanel];
    if (resetFn) {
      resetFn();
    }
  };

  const handleClose = () => {
    setFontLayoutSettingsDialogOpen(false);
  };

  // handle activeSettingsItemId: switch to correct panel and scroll to item
  useEffect(() => {
    if (!activeSettingsItemId) return;

    // parse panel from item id (format: settings.panel.itemName)
    const parts = activeSettingsItemId.split('.');
    if (parts.length >= 2) {
      const panelMap: Record<string, SettingsPanelType> = {
        font: 'Font',
        layout: 'Layout',
        color: 'Color',
        control: 'Control',
        language: 'Language',
        ai: 'AI',
        custom: 'Custom',
      };
      const panelKey = parts[1]?.toLowerCase();
      const targetPanel = panelMap[panelKey || ''];
      if (targetPanel && targetPanel !== activePanel) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- panel switch based on external navigation is intended
        setActivePanel(targetPanel);
      }
    }

    // scroll to item after panel renders
    const timeoutId = setTimeout(() => {
      const element = panelRef.current?.querySelector(
        `[data-setting-id="${activeSettingsItemId}"]`,
      );
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('settings-highlight');
        setTimeout(() => element.classList.remove('settings-highlight'), 2000);
      }
      setActiveSettingsItemId(null);
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [activeSettingsItemId, activePanel, setActiveSettingsItemId]);

  const currentPanel = tabConfig.find((tab) => tab.tab === activePanel);

  return (
    <Dialog
      isOpen={true}
      onClose={handleClose}
      className='modal-open'
      bgClassName={bookKey ? 'sm:!bg-black/20' : 'sm:!bg-black/50'}
      boxClassName={clsx(
        'sm:min-w-[520px] overflow-hidden',
        appService?.isMobile && 'sm:max-w-[90%] sm:w-3/4',
      )}
      snapHeight={appService?.isMobile ? 0.7 : undefined}
      header={
        <div className='flex w-full flex-col items-center'>
          <div className='flex w-full flex-row items-center justify-between'>
            <div 
              role='group'
              aria-label={_('Settings Panels') + ' - ' + (currentPanel?.label || '')}
              className={clsx(
                'dialog-tabs ms-1 flex flex-wrap w-full items-center gap-1',
              )}
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {tabConfig
                .filter((t) => !t.disabled)
                .map(({ tab, icon: Icon, label }) => (
                  <div key={tab} className="tooltip tooltip-bottom" data-tip={label}>
                    <button
                      data-tab={tab}
                      className={clsx(
                        'btn btn-ghost text-base-content btn-sm gap-1 px-1',
                        activePanel === tab ? 'btn-active' : '',
                      )}
                      onClick={() => handleSetActivePanel(tab)}
                    >
                      <Icon className='mr-0' />
                    </button>
                  </div>
                ))
              }
            </div>
            <div className='flex h-full items-center justify-end gap-x-2'>
              <button
                onClick={handleOpenCommandPalette}
                aria-label={_('Search Settings')}
                title={`${_('Search Settings')} (${getCommandPaletteShortcut()})`}
                className='btn btn-ghost flex h-6 min-h-6 w-6 items-center justify-center p-0'
              >
                <FiSearch />
              </button>
              <Dropdown
                label={_('Settings Menu')}
                className='dropdown-bottom dropdown-end'
                buttonClassName='btn btn-ghost h-6 min-h-6 w-6 p-0 flex items-center justify-center'
                toggleButton={<PiDotsThreeVerticalBold />}
              >
                <DialogMenu
                  activePanel={activePanel}
                  onReset={handleResetCurrentPanel}
                  resetLabel={
                    currentPanel
                      ? _('Reset {{settings}}', { settings: currentPanel.label })
                      : undefined
                  }
                />
              </Dropdown>
              <button
                onClick={handleClose}
                aria-label={_('Close')}
                className={
                  'bg-base-300/65 btn btn-ghost btn-circle h-6 min-h-6 w-6 p-0 flex'
                }
              >
                <MdClose size={16} />
              </button>
            </div>
          </div>
          <div className='tab-title flex py-1 text-base text-success font-bold'>
            {currentPanel?.label || ''}
          </div>
        </div>
      }
    >
      <div
        ref={panelRef}
        role='group'
        aria-label={`${_(currentPanel?.label || '')} - ${_('Settings')}`}
      >
        {activePanel === 'Font' && (
          <FontPanel 
            bookKey={bookKey} 
            onRegisterReset={(fn) => registerResetFunction('Font', fn)} 
          />
        )}
        {activePanel === 'Layout' && (
          <LayoutPanel
            bookKey={bookKey}
            onRegisterReset={(fn) => registerResetFunction('Layout', fn)}
          />
        )}
        {activePanel === 'Color' && (
          <ColorPanel
            bookKey={bookKey}
            onRegisterReset={(fn) => registerResetFunction('Color', fn)}
          />
        )}
        {activePanel === 'Control' && (
          <ControlPanel
            bookKey={bookKey}
            onRegisterReset={(fn) => registerResetFunction('Control', fn)}
          />
        )}
        {activePanel === 'Language' && (
          <LangPanel
            bookKey={bookKey}
            onRegisterReset={(fn) => registerResetFunction('Language', fn)}
          />
        )}
        {activePanel === 'AI' && <AIPanel />}
        {activePanel === 'Custom' && (
          <MiscPanel
            bookKey={bookKey}
            onRegisterReset={(fn) => registerResetFunction('Custom', fn)}
          />
        )}
      </div>
    </Dialog>
  );
};

export default SettingsDialog;
