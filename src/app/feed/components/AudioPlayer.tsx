import React, { useRef, useState, useEffect } from 'react';
import { IoMdPlay, IoMdPause, IoMdVolumeHigh, IoMdVolumeMute } from 'react-icons/io';
import { TbPlaylist } from 'react-icons/tb';
import { ArticleType } from './dataAgent';

type Props = {
  currentPod: ArticleType;
  className?: string;
  onPlaylistClick?: () => void;
  playlist?: ArticleType[];
  onPlayNext?: (article: ArticleType) => void;
};

export default function AudioPlayer(props: Props) {
  const { currentPod, className = '', onPlaylistClick, playlist = [], onPlayNext } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const audioUrl = currentPod.audio_url;
  const title = currentPod.title;

  // When audio changes, try to auto-play
  useEffect(() => {
    if (audioRef.current && audioUrl) {
      audioRef.current.src = audioUrl;
      // Reset time and duration when audio changes
      setCurrentTime(0);
      setDuration(0);
      // Auto-play if there's audio
      audioRef.current.play().catch(err => {
        console.log('Auto-play failed:', err);
      });
      setIsPlaying(true);
    }
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().catch(err => {
          console.error('Play failed:', err);
        });
        setIsPlaying(true);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      console.log('Audio loaded. Duration:', audioRef.current.duration);
    }
  };

  const handleLoadStart = () => {
    console.log('Audio load started');
  };

  const handleCanPlay = () => {
    if (audioRef.current) {
      console.log('Audio can play. Duration:', audioRef.current.duration);
      setDuration(audioRef.current.duration);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
      // Resume playback if it was playing before seeking
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.error('Resume play after seek failed:', err);
        });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    // Auto-play next track if available
    if (playlist && playlist.length > 0 && onPlayNext) {
      const currentIndex = playlist.findIndex(a => a.link === currentPod.link);
      if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
        const nextArticle = playlist[currentIndex + 1];
        if (nextArticle) onPlayNext(nextArticle);
      }
    }
  };

  if (!currentPod || !audioUrl) {
    return (<div className='mx-1 text-sm'>no player</div>);
  }

  return (
    <div className={`flex flex-col gap-2 p-2 bg-base-200 rounded ${className}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onLoadStart={handleLoadStart}
        onCanPlay={handleCanPlay}
        onEnded={handleEnded}
        crossOrigin='anonymous'
      />
      
      {title && (
        <div className='text-xs font-semibold truncate text-base-content/80'>
          {title}
        </div>
      )}
      
      <div className='flex items-center gap-1'>
        <button
          onClick={togglePlayPause}
          className='btn btn-xs btn-primary'
        >
          {isPlaying ? <IoMdPause size={16} /> : <IoMdPlay size={16} />}
        </button>
        
        <span className='text-xs text-base-content/60 min-w-[35px]'>
          {formatTime(currentTime)}
        </span>
        
        <input
          type='range'
          min='0'
          max={duration || 0}
          value={currentTime}
          onChange={handleProgressChange}
          className='range range-xs flex-1 h-1'
        />
        
        <span className='text-xs text-base-content/60 min-w-[35px] text-right'>
          {formatTime(duration)}
        </span>
      </div>

      <div className='flex items-center gap-1'>
        <button
          onClick={toggleMute}
          className='btn btn-xs btn-ghost'
        >
          {isMuted ? <IoMdVolumeMute size={16} /> : <IoMdVolumeHigh size={16} />}
        </button>
        
        <input
          type='range'
          min='0'
          max='1'
          step='0.01'
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className='range range-xs w-20 h-1'
        />
        
        {onPlaylistClick && (
          <button
            onClick={onPlaylistClick}
            className='btn btn-xs btn-ghost ml-auto'
          >
            <TbPlaylist size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
