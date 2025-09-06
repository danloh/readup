import clsx from 'clsx';
import React, { useState, ChangeEvent, useEffect } from 'react';
import { RiVoiceAiFill, RiTimerLine } from 'react-icons/ri';
import { FaBackward, FaFastBackward, FaFastForward, FaForward } from 'react-icons/fa';
import { MdCheck, MdSpeed, MdPlayCircle, MdPauseCircle } from 'react-icons/md';
import { TTSVoicesGroup } from '@/services/tts';
import { useEnv } from '@/context/EnvContext';
import { useReaderStore } from '@/store/readerStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { useDefaultIconSize, useResponsiveSize } from '@/hooks/useResponsiveSize';
import { getLanguageName } from '@/utils/lang';

type TTSPanelProps = {
  bookKey: string;
  ttsLang: string;
  isPlaying: boolean;
  timeoutOption: number;
  timeoutTimestamp: number;
  onTogglePlay: () => void;
  onBackward: (byMark: boolean) => void;
  onForward: (byMark: boolean) => void;
  onSetRate: (rate: number) => void;
  onGetVoices: (lang: string) => Promise<TTSVoicesGroup[]>;
  onSetVoice: (voice: string, lang: string) => void;
  onGetVoiceId: () => string;
  onSelectTimeout: (bookKey: string, value: number) => void;
};

const getCountdownTime = (timeout: number) => {
  const now = Date.now();
  if (timeout > now) {
    const remainingTime = Math.floor((timeout - now) / 1000);
    const minutes = Math.floor(remainingTime / 3600) * 60 + Math.floor((remainingTime % 3600) / 60);
    const seconds = remainingTime % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
  return '';
};

const TTSPanel = ({
  bookKey,
  ttsLang,
  isPlaying,
  timeoutOption, // unit seconds
  timeoutTimestamp,
  onTogglePlay,
  onBackward,
  onForward,
  onSetRate,
  onGetVoices,
  onSetVoice,
  onGetVoiceId,
  onSelectTimeout,
}: TTSPanelProps) => {
  const _ = useTranslation();
  const { envConfig } = useEnv();
  const { getViewSettings, setViewSettings } = useReaderStore();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const viewSettings = getViewSettings(bookKey);

  const [voiceGroups, setVoiceGroups] = useState<TTSVoicesGroup[]>([]);
  const [rate, setRate] = useState(viewSettings?.ttsRate ?? 1.0);
  const [selectedVoice, setSelectedVoice] = useState(viewSettings?.ttsVoice ?? '');

  const [showRate, setShowRate] = useState(false);
  const [showTimer, setShowTimer] = useState(false);
  const showSetting = (ty: string) => {
    if (ty === 'rate') {
      setShowRate((prev) => !prev);
      setShowTimer(false);
    } else {
      setShowTimer((prev) => !prev);
      setShowRate(false);
    }
  };

  const [timeoutCountdown, setTimeoutCountdown] = useState(() => {
    return getCountdownTime(timeoutTimestamp);
  });

  const defaultIconSize = useDefaultIconSize();
  const iconSize24 = useResponsiveSize(24);
  const iconSize22 = useResponsiveSize(22);

  const handleSetRate = (e: ChangeEvent<HTMLInputElement>) => {
    let newRate = parseFloat(e.target.value);
    newRate = Math.max(0.2, Math.min(3.0, newRate));
    setRate(newRate);
    onSetRate(newRate);
    const viewSettings = getViewSettings(bookKey)!;
    viewSettings.ttsRate = newRate;
    settings.globalViewSettings.ttsRate = newRate;
    setViewSettings(bookKey, viewSettings);
    setSettings(settings);
    saveSettings(envConfig, settings);
  };

  const handleSetTimer = (e: ChangeEvent<HTMLInputElement>) => {
    let newTimer = parseInt(e.target.value) * 60; // unit: second
    console.log("timeout", newTimer);
    newTimer = Math.max(0, Math.min(180 * 60, newTimer));
    console.log("timeout 1", newTimer);
    onSelectTimeout(bookKey, newTimer);
  };

  const handleSelectVoice = (voice: string, lang: string) => {
    onSetVoice(voice, lang);
    setSelectedVoice(voice);
    const viewSettings = getViewSettings(bookKey)!;
    viewSettings.ttsVoice = voice;
    setViewSettings(bookKey, viewSettings);
  };

  const updateTimeout = (timeout: number) => {
    const now = Date.now();
    if (timeout > 0 && timeout < now) {
      onSelectTimeout(bookKey, 0);
      setTimeoutCountdown('');
    } else if (timeout > 0) {
      setTimeoutCountdown(getCountdownTime(timeout));
    }
  };

  useEffect(() => {
    setTimeout(() => {
      updateTimeout(timeoutTimestamp);
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutTimestamp, timeoutCountdown]);

  useEffect(() => {
    const voiceId = onGetVoiceId();
    setSelectedVoice(voiceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const fetchVoices = async () => {
      const voiceGroups = await onGetVoices(ttsLang);
      const voicesCount = voiceGroups.reduce((acc, group) => acc + group.voices.length, 0);
      if (!voiceGroups || voicesCount === 0) {
        console.warn('No voices found for TTSPanel');
        setVoiceGroups([
          {
            id: 'no-voices',
            name: _('Voices for {{lang}}', { lang: getLanguageName(ttsLang) }),
            voices: [],
          },
        ]);
      } else {
        setVoiceGroups(voiceGroups);
      }
    };
    fetchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ttsLang]);

  return (
    <div className='flex w-full flex-col items-center justify-center gap-1 rounded-xl p-2'>
      {showRate && (
        <div className='flex w-full flex-col items-center gap-0.5'>
          <input
            className='range range-xs'
            type='range'
            min={0.0}
            max={3.0}
            step='0.1'
            value={rate}
            onChange={handleSetRate}
          />
          <div className='grid w-full grid-cols-7 text-xs'>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
          </div>
          <div className='grid w-full grid-cols-7 text-xs'>
            <span className='text-center'>{_('Slow')}</span>
            <span className='text-center'></span>
            <span className='text-center'>1.0</span>
            <span className='text-center'></span>
            <span className='text-center'>2.0</span>
            <span className='text-center'></span>
            <span className='text-center'>{_('Fast')}</span>
          </div>
        </div>
      )}
      {showTimer && (
        <div className='flex w-full flex-col items-center gap-0.5'>
          <input
            className='range range-xs'
            type='range'
            min={0}
            max={180}
            step='5'
            value={timeoutOption / 60}
            onChange={handleSetTimer}
          />
          <div className='grid w-full grid-cols-7 text-xs'>
            <span className='text-left'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-center'>|</span>
            <span className='text-right'>|</span>
          </div>
          <div className='grid w-full grid-cols-7 text-xs'>
            <span className='text-left'>{_('Off')}</span>
            <span className='text-center'></span>
            <span className='text-center'>60</span>
            <span className='text-center'></span>
            <span className='text-center'>115</span>
            <span className='text-center'></span>
            <span className='text-right'>180</span>
          </div>
        </div>
      )}
      <div className='flex items-center justify-between gap-x-1.5'>
        <div className='dropdown'>
          <button
            onClick={() => showSetting('rate')}
            className='flex flex-col items-center justify-center rounded-full p-1'
          >
            <MdSpeed size={iconSize22} className={clsx(showRate && 'fill-success')} />
            {rate && (
              <span
                className={clsx(
                  'absolute bottom-0 left-1/2 w-8 translate-x-[-50%] translate-y-[80%] px-1',
                  'bg-primary/80 text-base-100 rounded-full text-center text-[8px]',
                )}
              >
                {`${rate}X`}
              </span>
            )}
          </button>
        </div>
        <button 
          onClick={onBackward.bind(null, false)} 
          className='rounded-full p-1 transition-transform duration-200 hover:scale-105' 
          title={_('Previous Paragraph')}
          aria-label={_('Previous Paragraph')}
        >
          <FaFastBackward size={iconSize22} />
        </button>
        <button 
          onClick={onBackward.bind(null, true)} 
          className='rounded-full p-1 transition-transform duration-200 hover:scale-105' 
          title={_('Previous Sentence')}
          aria-label={_('Previous Sentence')}
        >
          <FaBackward size={iconSize22} />
        </button>
        <button 
          onClick={onTogglePlay} 
          className='rounded-full p-1 transition-transform duration-200 hover:scale-110'
        >
          {isPlaying ? (
            <MdPauseCircle size={iconSize24} className='fill-primary' />
          ) : (
            <MdPlayCircle size={iconSize24} className='fill-primary' />
          )}
        </button>
        <button 
          onClick={onForward.bind(null, true)} 
          className='rounded-full p-1 transition-transform duration-200 hover:scale-105' 
          title={_('Next Sentence')}
          aria-label={_('Next Sentence')}
        >
          <FaForward size={iconSize22} />
        </button>
        <button 
          onClick={onForward.bind(null, false)} 
          className='rounded-full p-1 transition-transform duration-200 hover:scale-105' 
          title={_('Next Paragraph')}
          aria-label={_('Next Paragraph')}
        >
          <FaFastForward size={iconSize22} />
        </button>
        <div className='dropdown'>
          <button
            onClick={() => showSetting('timer')}
            className='flex flex-col items-center justify-center rounded-full p-1'
          >
            <RiTimerLine size={iconSize22} className={clsx(showTimer && 'fill-success')} />
            {timeoutCountdown && (
              <span
                className={clsx(
                  'absolute bottom-0 left-1/2 w-12 translate-x-[-50%] translate-y-[80%] px-1',
                  'bg-primary/80 text-base-100 rounded-full text-center text-[8px]',
                )}
              >
                {timeoutCountdown}
              </span>
            )}
          </button>
        </div>
        <div className='dropdown dropdown-top'>
          <button tabIndex={0} className='rounded-full p-1'>
            <RiVoiceAiFill size={iconSize22} />
          </button>
          <ul
            tabIndex={0}
            className={clsx(
              'dropdown-content bgcolor-base-200 no-triangle menu menu-vertical rounded-box absolute right-0 z-[1] shadow',
              'mt-4 inline max-h-96 w-[250px] overflow-y-scroll',
            )}
          >
            {voiceGroups.map((voiceGroup, index) => {
              return (
                <div key={voiceGroup.id} className=''>
                  <div className='flex items-center gap-2 px-2 py-1'>
                    <span
                      style={{ width: `${defaultIconSize}px`, height: `${defaultIconSize}px` }}
                    ></span>
                    <span className='text-sm text-gray-400 sm:text-xs'>
                      {_('{{engine}}: {{count}} voices', {
                        engine: _(voiceGroup.name),
                        count: voiceGroup.voices.length,
                      })}
                    </span>
                  </div>
                  {voiceGroup.voices.map((voice, voiceIndex) => (
                    <li
                      key={`${index}-${voiceGroup.id}-${voiceIndex}`}
                      onClick={() => !voice.disabled && handleSelectVoice(voice.id, voice.lang)}
                    >
                      <div className='flex items-center px-2'>
                        <span
                          style={{
                            width: `${defaultIconSize}px`,
                            height: `${defaultIconSize}px`,
                          }}
                        >
                          {selectedVoice === voice.id && <MdCheck className='text-base-content' />}
                        </span>
                        <span
                          className={clsx(
                            'max-w-[180px] overflow-hidden text-ellipsis text-base sm:text-sm',
                            voice.disabled && 'text-gray-400',
                          )}
                        >
                          {_(voice.name)}
                        </span>
                      </div>
                    </li>
                  ))}
                </div>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default TTSPanel;
