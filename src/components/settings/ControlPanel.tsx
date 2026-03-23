import React, { useEffect, useState } from 'react';
import { MdJoinLeft } from 'react-icons/md';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useDeviceControlStore } from '@/store/deviceStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useResetViewSettings } from '@/hooks/useResetSettings';
import { getStyles } from '@/styles/style';
import { RELOAD_BEFORE_SAVED_TIMEOUT_MS } from '@/services/constants';
import { getMaxInlineSize } from '@/utils/config';
import { saveViewSettings } from '@/helpers/settings';
import { annotationToolQuickActions } from '@/app/reader/components/annotator/AnnotationTools';
import { SettingsPanelPanelProp } from './SettingsDialog';
import NumberInput from './NumberInput';
import Select from '../Select';

const ControlPanel: React.FC<SettingsPanelPanelProp> = ({ bookKey, onRegisterReset }) => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { getView, getViewSettings, recreateViewer } = useReaderStore();
  const { getBookData } = useBookDataStore();
  const { settings } = useSettingsStore();
  const { acquireVolumeKeyInterception, releaseVolumeKeyInterception } = useDeviceControlStore();
  const bookData = getBookData(bookKey);
  const viewSettings = getViewSettings(bookKey) || settings.globalViewSettings;

  const [isScrolledMode, setScrolledMode] = useState(viewSettings.scrolled);
  const [scrollingOverlap, setScrollingOverlap] = 
    useState(viewSettings.scrollingOverlap);
  const [hideScrollbar, setHideScrollbar] = useState(viewSettings.hideScrollbar || false);
  const [volumeKeysToFlip, setVolumeKeysToFlip] = 
    useState(viewSettings.volumeKeysToFlip);
  const [isDisableClick, setIsDisableClick] = useState(viewSettings.disableClick);
  const [fullscreenClickArea, setFullscreenClickArea] = 
    useState(viewSettings.fullscreenClickArea);
  const [isDisableDoubleClick, setIsDisableDoubleClick] = 
    useState(viewSettings.disableDoubleClick);
  const [swapClickArea, setSwapClickArea] = useState(viewSettings.swapClickArea);
  const [showPaginationButtons, setShowPaginationButtons] = useState(
    viewSettings.showPaginationButtons,
  );
  const [animated, setAnimated] = useState(viewSettings.animated);
  const [allowScript, setAllowScript] = useState(viewSettings.allowScript);
  const [enableAnnotationQuickActions, setEnableAnnotationQuickActions] = useState(
    viewSettings.enableAnnotationQuickActions,
  );
  const [annotationQuickAction, setAnnotationQuickAction] = useState(
    viewSettings.annotationQuickAction,
  );
  const [copyToNotebook, setCopyToNotebook] = useState(viewSettings.copyToNotebook);

  const resetToDefaults = useResetViewSettings();

  const handleReset = () => {
    resetToDefaults({
      scrolled: setScrolledMode,
      scrollingOverlap: setScrollingOverlap,
      hideScrollbar: setHideScrollbar,
      volumeKeysToFlip: setVolumeKeysToFlip,
      disableClick: setIsDisableClick,
      swapClickArea: setSwapClickArea,
      animated: setAnimated,
      allowScript: setAllowScript,
      fullscreenClickArea: setFullscreenClickArea,
      disableDoubleClick: setIsDisableDoubleClick,
      enableAnnotationQuickActions: setEnableAnnotationQuickActions,
      copyToNotebook: setCopyToNotebook,
    });
  };

  useEffect(() => {
    onRegisterReset(handleReset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isScrolledMode === viewSettings.scrolled) return;
    saveViewSettings(envConfig, bookKey, 'scrolled', isScrolledMode);
    getView(bookKey)?.renderer.setAttribute('flow', isScrolledMode ? 'scrolled' : 'paginated');
    getView(bookKey)?.renderer.setAttribute(
      'max-inline-size',
      `${getMaxInlineSize(viewSettings)}px`,
    );
    getView(bookKey)?.renderer.setStyles?.(getStyles(viewSettings!));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScrolledMode]);

  useEffect(() => {
    if (scrollingOverlap === viewSettings.scrollingOverlap) return;
    saveViewSettings(envConfig, bookKey, 'scrollingOverlap', scrollingOverlap, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollingOverlap]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'hideScrollbar', hideScrollbar, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hideScrollbar]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'volumeKeysToFlip', volumeKeysToFlip, false, false);
    if (appService?.isMobileApp) {
      if (volumeKeysToFlip) {
        acquireVolumeKeyInterception();
      } else {
        releaseVolumeKeyInterception();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volumeKeysToFlip]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'disableClick', isDisableClick, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisableClick]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'disableDoubleClick', isDisableDoubleClick, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisableDoubleClick]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'fullscreenClickArea', fullscreenClickArea, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreenClickArea]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'swapClickArea', swapClickArea, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swapClickArea]);

  useEffect(() => {
    saveViewSettings(
      envConfig,
      bookKey,
      'showPaginationButtons',
      showPaginationButtons,
      false,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPaginationButtons]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'animated', animated, false, false);
    if (animated) {
      getView(bookKey)?.renderer.setAttribute('animated', '');
    } else {
      getView(bookKey)?.renderer.removeAttribute('animated');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animated]);

  useEffect(() => {
    if (viewSettings.allowScript === allowScript) return;
    saveViewSettings(envConfig, bookKey, 'allowScript', allowScript, true, false);
    setTimeout(() => {
      recreateViewer(envConfig, bookKey);
    }, RELOAD_BEFORE_SAVED_TIMEOUT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowScript]);

  useEffect(() => {
    saveViewSettings(
      envConfig,
      bookKey,
      'enableAnnotationQuickActions',
      enableAnnotationQuickActions,
      false,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableAnnotationQuickActions]);

  useEffect(() => {
    saveViewSettings(envConfig, bookKey, 'copyToNotebook', copyToNotebook, false, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copyToNotebook]);

  const getQuickActionOptions = () => {
    return [
      {
        value: '',
        label: _('None'),
      },
      ...annotationToolQuickActions.map((button) => ({
        value: button.type,
        label: _(button.label),
      })),
    ];
  };

  const handleSelectAnnotationQuickAction = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const action = event.target.value as typeof annotationQuickAction;
    setAnnotationQuickAction(action);
    saveViewSettings(envConfig, bookKey, 'annotationQuickAction', action, false, true);
  };

  return (
    <div className='my-4 w-full space-y-4'>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.clickToPaginate'
      >
        <b className=''>
          {appService?.isMobileApp ? _('Tap to Paginate') : _('Click to Paginate')}
        </b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={!isDisableClick}
          onChange={() => setIsDisableClick(!isDisableClick)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.disableDoubleClick'
      >
        <b className=''>
          {appService?.isMobileApp ? _('Disable Double Tap') : _('Disable Double Click')}
        </b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={isDisableDoubleClick}
          onChange={() => setIsDisableDoubleClick(!isDisableDoubleClick)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.showPaginationButtons'
      >
        <b className=''>{_('Show Page Navigation Buttons')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={showPaginationButtons}
          onChange={() => setShowPaginationButtons(!showPaginationButtons)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.pagingAnimation'
      >
        <b className=''>{_('Paging Animation')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={animated}
          onChange={() => setAnimated(!animated)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.clickBothSides'
      >
        <b className=''>
          {appService?.isMobileApp ? _('Tap Both Sides') : _('Click Both Sides')}
        </b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={fullscreenClickArea}
          disabled={isDisableClick}
          onChange={() => setFullscreenClickArea(!fullscreenClickArea)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.swapClickSides'
      >
        <b className=''>
          {appService?.isMobileApp ? _('Swap Tap Sides') : _('Swap Click Sides')}
        </b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={swapClickArea}
          disabled={isDisableClick || fullscreenClickArea}
          onChange={() => setSwapClickArea(!swapClickArea)}
        />
      </div>
      {appService?.isMobileApp && (
        <div className='flex items-center justify-between'>
          <b className=''>{_('Volume Keys for Page Flip')}</b>
          <input
            type='checkbox'
            className='toggle toggle-success h-5'
            checked={volumeKeysToFlip}
            onChange={() => setVolumeKeysToFlip(!volumeKeysToFlip)}
          />
        </div>
      )}
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.scrolledMode'
      >
        <b className=''>{_('Scrolled Mode')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          disabled={bookData?.isFixedLayout}
          checked={isScrolledMode}
          onChange={() => setScrolledMode(!isScrolledMode)}
        />
      </div>
      <div 
        className='flex items-center justify-between' 
        data-setting-id='settings.control.scroll.hideScrollbar'
      >
        <b className=''>{_('Hide Scrollbar')}</b>
        <input
          type='checkbox'
          className='toggle toggle-success h-5'
          checked={hideScrollbar}
          disabled={!viewSettings.scrolled}
          onChange={() => setHideScrollbar(!hideScrollbar)}
        />
      </div>
      <NumberInput
        Icon={MdJoinLeft}
        label={_('Overlap Pixels')}
        value={scrollingOverlap}
        onChange={setScrollingOverlap}
        disabled={!viewSettings.scrolled}
        min={0}
        max={200}
        step={10}
        data-setting-id='settings.control.overlapPixels'
      />

      <div className='w-full' data-setting-id='settings.control.quickAction'>
        <div className='card border-base-200 bg-base-100 border shadow p-2'>
          <h2 className='mb-2 font-medium text-center'>{_('Annotation Tools')}</h2>
          <div className='divide-base-200 divide-y'>
            <div className='config-item'>
              <b className=''>{_('Enable Quick Actions')}</b>
              <input
                type='checkbox'
                className='toggle toggle-success h-5'
                checked={enableAnnotationQuickActions}
                onChange={() => setEnableAnnotationQuickActions(!enableAnnotationQuickActions)}
              />
            </div>
            <div className='config-item'>
              <b className=''>{_('Quick Action')}</b>
              <Select
                value={annotationQuickAction || ''}
                onChange={handleSelectAnnotationQuickAction}
                options={getQuickActionOptions()}
                disabled={!enableAnnotationQuickActions}
              />
            </div>
            <div className='config-item'>
              <b className=''>{_('Copy to Notebook')}</b>
              <input
                type='checkbox'
                className='toggle toggle-success h-5'
                checked={copyToNotebook}
                onChange={() => setCopyToNotebook(!copyToNotebook)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* {(appService?.isMobileApp || appService?.appPlatform === 'web') && (
        <div className='w-full'>
          <div className='card border-base-200 bg-base-100 border shadow'>
            <div className='divide-base-200 divide-y'>
              {appService?.isMobileApp && (
                <div className='config-item'>
                  <span className=''>{_('Auto Screen Brightness')}</span>
                  <input
                    type='checkbox'
                    className='toggle'
                    checked={autoScreenBrightness}
                    onChange={() => setAutoScreenBrightness(!autoScreenBrightness)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )} */}

      <div className='w-full'>
        <div className='card border-base-200 bg-base-100 border shadow'>
          <div className='divide-base-200 divide-y'>
            <div className='config-item !h-16' data-setting-id='settings.control.allowJavascript'>
              <div className='flex flex-col gap-1'>
                <b className=''>{_('Allow JavaScript')}</b>
                <span className='text-xs'>{_('Enable only if you trust the file.')}</span>
              </div>
              <input
                type='checkbox'
                className='toggle toggle-success h-5'
                checked={allowScript}
                disabled={bookData?.book?.format !== 'EPUB'}
                onChange={() => setAllowScript(!allowScript)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
