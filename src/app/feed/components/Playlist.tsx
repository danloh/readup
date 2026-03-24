import React, { useEffect, useState } from 'react';
import { IoMdPlay, IoMdLink } from 'react-icons/io';
import { useEnv } from '@/context/EnvContext';
import { fmtDatetime, getFavicon, ArticleType } from './dataAgent';

type Props = {
  onSelectArticle: (article: ArticleType) => void;
  currentPlaying?: ArticleType | null;
  showSide?: () => void;
};

export function Playlist(props: Props) {
  const { onSelectArticle, currentPlaying, showSide } = props;
  const { envConfig } = useEnv();
  const [playlistItems, setPlaylistItems] = useState<ArticleType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const appService = await envConfig.getAppService();
        const localArticles = await appService.loadArticles();
        // Filter starred articles that have audio_url
        const audioArticles = localArticles.filter(
          (a) => a.status === 'star' && a.audio_url?.trim()
        );
        setPlaylistItems(audioArticles);
      } catch (error) {
        console.error('Failed to load playlist:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className='flex items-center justify-center w-full h-full'>
        Loading playlist...
      </div>
    );
  }

  if (playlistItems.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center w-full h-full gap-4'>
        <p className='text-base-content/60'>No audio available in your starred articles</p>
        <p className='text-sm text-base-content/40'>Star articles with audio to add them here</p>
      </div>
    );
  }

  return (
    <div className='flex flex-col h-full w-full overflow-y-auto'>
      <div className='flex flex-row items-center justify-start gap-2 p-2 bg-base-300 sticky top-0'>
        <button className='btn btn-xs btn-ghost' onClick={showSide}>
          ☰
        </button>
        <b className='text-info'>{playlistItems.length}</b>
        <b className='font-bold'>Audio Playlist</b>
      </div>
      <div className='p-2 space-y-2'>
        {playlistItems.map((article, idx) => {
          const isActive = currentPlaying?.link === article.link;
          return (
            <div
              key={`${article.link}-${idx}`}
              className={`flex flex-col p-2 border rounded cursor-pointer transition-colors ${
                isActive
                  ? 'bg-primary/20 border-primary'
                  : 'bg-base-200 border-base-300 hover:bg-base-300'
              }`}
            >
              <div className='flex flex-row items-start justify-between gap-2'>
                <div className='flex-1 min-w-0'>
                  <h3 className='text-sm font-semibold truncate text-info'>
                    {article.title}
                  </h3>
                  <p className='text-xs text-base-content/60 truncate hidden'>
                    {article.audio_url}
                  </p>
                  <p className='text-xs text-base-content/50'>
                    {fmtDatetime(article.published || '')}
                  </p>
                </div>
                <button
                  onClick={() => onSelectArticle(article)}
                  className={`btn btn-xs gap-1 ${
                    isActive ? 'btn-primary' : 'btn-outline'
                  }`}
                >
                  <IoMdPlay size={14} />
                  Play
                </button>
              </div>
              {article.description && (
                <p className='text-xs text-base-content/70 line-clamp-2 mt-1'>
                  {article.description}
                </p>
              )}
              <div className='flex flex-row items-center gap-2 mt-2'>
                <img
                  src={getFavicon(article.link!)}
                  className='h-3 w-3'
                  alt='>'
                  loading='lazy'
                />
                <a
                  href={article.link}
                  target='_blank'
                  rel='noreferrer'
                  className='text-xs text-primary hover:underline flex items-center gap-1'
                >
                  <IoMdLink size={12} />
                  Read article
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
