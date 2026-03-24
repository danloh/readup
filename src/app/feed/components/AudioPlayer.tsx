import { useState } from 'react';
import { TbPlaylist } from 'react-icons/tb';
import { ArticleType } from './dataAgent';

type Props = {
  currentPod: ArticleType;
  className?: string;
  showPlaylist: () => void;
  playlist?: ArticleType[];
  setNext?: (article: ArticleType) => void;
};

export default function AudioPlayer(props: Props) {
  const { currentPod, className = '', showPlaylist, playlist = [], setNext } = props;
  const [pod, setPod] = useState(currentPod);

  const handleEnded = () => {
    // setIsPlaying(false);
    console.log('Auto-play Next');
    // Auto-play next track if available
    if (playlist && playlist.length > 0) {
      const currentIndex = playlist.findIndex(a => a.link === currentPod.link);
      if (currentIndex !== -1 && currentIndex < playlist.length - 1) {
        const nextArticle = playlist[currentIndex + 1];
        if (nextArticle) {
          setPod(nextArticle);
          setNext?.(nextArticle);
        }
      }
    }
  };

  if (!currentPod) {
    return (<div className='mx-1 text-sm'>no player</div>);
  }

  return (
    <div className={`flex flex-col gap-2 p-2 bg-base-200 rounded ${className}`}>
      {pod.title && (
        <div className='text-xs font-semibold truncate text-base-content/80'>
          {pod.title}
        </div>
      )}
      <div className='flex items-center gap-1'>
        <audio 
          autoPlay 
          controls 
          className="h-5 w-full bg-base-200" 
          src={pod.audio_url} 
          onEnded={handleEnded}
        />
        <button onClick={showPlaylist} className='btn btn-xs btn-ghost ml-auto'>
          <TbPlaylist size={16} />
        </button>
      </div>
    </div>
  );
}
