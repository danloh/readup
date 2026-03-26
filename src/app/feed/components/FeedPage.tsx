import { useEffect, useState, useRef } from 'react';
// import clsx from 'clsx';
import { useEnv } from '@/context/EnvContext';
import { isWebAppPlatform } from '@/services/environment';
import { mergeArrays } from '@/utils/book';
import { ChannelList } from './ChannelList';
import { Channel } from './Channel';
import { FeedManager } from './FeedManager';
import { Playlist } from './Playlist';
import AudioPlayer from './AudioPlayer';
import * as dataAgent from './dataAgent';
import { ArticleType, FeedType } from './dataAgent';

export default function FeedPage() {
  const { envConfig } = useEnv();
  // channel list
  const [channelList, setChannelList] = useState<FeedType[]>([]);
  const [currentChannel, setCurrentChannel] = useState<FeedType | null>(null);
  const [currentEntries, setCurrentEntries] = useState<ArticleType[] | null>(null);
  const [isStarChannel, setIsStarChannel] = useState(false);
  const [showManager, setShowManager] = useState(false);
  const [showFeedSide, setShowFeedSide] = useState(true);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState<ArticleType | null>(null);
  const [playlistItems, setPlaylistItems] = useState<ArticleType[]>([]);
  const isInitiating = useRef(false);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;
    const initFeeds = async () => {
      const appService = await envConfig.getAppService();
      setChannelList(await appService.loadFeeds());
      // Load playlist on init
      await loadPlaylistItems();
    };

    initFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPlaylistItems = async () => {
    try {
      const appService = await envConfig.getAppService();
      const localArticles = await appService.loadArticles();
      const audioArticles = localArticles.filter(
        (a) => a.status === 'star' && a.audio_url?.trim()
      );
      setPlaylistItems(audioArticles);
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  };

  const loadFeed = async (link: string) => {
    const res = await dataAgent.fetchFeed(link);
    const articles = res.articles; 
    if (!isWebAppPlatform()) {
      // on Web, fetchFeed with no article content which will fetch later on ArticleView;
      // On Tauri, fetchFeed with full articles, so save loacally as cache.
      if (articles && articles.length > 0) {
        const appService = await envConfig.getAppService();
        const oldArticles = await appService.loadArticles();
        const mergedArticles = mergeArrays(oldArticles, articles, 'link');
        await appService.saveArticles(mergedArticles);
      }
    }
    setCurrentEntries(articles || []);
  };

  const [loading, setLoading] = useState(false);
  const onClickFeed = async (link: string) => {
    setLoading(true);
    const clickedChannel = channelList.find(c => c.link === link);
    if (clickedChannel) {
      setCurrentChannel(clickedChannel);
      setShowManager(false);
      setShowPlaylist(false);
      await loadFeed(clickedChannel.link);
    } 
    setLoading(false);
    setIsStarChannel(false);
  };

  const onClickStar = async () => {
    setLoading(true);
    setCurrentChannel(null);
    setCurrentEntries(null);
    setIsStarChannel(true);
    setShowManager(false);
    setShowPlaylist(false);
    // load and filter star articles
    const appService = await envConfig.getAppService();
    const localArticles = await appService.loadArticles();
    // filter out audio articles which are listed in Playlist
    const starArticles = localArticles.filter(a => a.status === 'star' && !a.audio_url?.trim());
    setCurrentEntries(starArticles); 
    setLoading(false);
  };

  const handleAddFeed = async (link: string, ty: string, title: string) => {
    const feeds = channelList;
    const newFeed: FeedType = {ty, title, link};
    if (feeds.findIndex(f => f.link === link) === -1) {
      feeds.push(newFeed);
    }
    setChannelList(feeds);
    const appService = await envConfig.getAppService();
    await appService.saveFeeds(feeds);
    // setShowManager(false);
  };

  const handleDeleteFeed = async (channel: FeedType) => {
    const feeds = channelList;
    const newFeeds = feeds.filter(f => f.link !== channel.link);
    setChannelList(newFeeds);
    const appService = await envConfig.getAppService();
    await appService.saveFeeds(newFeeds);
  };

  const handleImportFeeds = async (importedFeeds: FeedType[]) => {
    const feeds = channelList;
    // Only add feeds that don't already exist
    for (const feed of importedFeeds) {
      if (!feeds.find(f => f.link === feed.link)) {
        feeds.push(feed);
      }
    }
    setChannelList(feeds);
    const appService = await envConfig.getAppService();
    await appService.saveFeeds(feeds);
  };

  const handlePlayAudio = (article: ArticleType, articles?: ArticleType[]) => {
    setCurrentPlayingAudio(article);
    // to reset playlist to audio player in case of playlist updated 
    if (articles && articles.length > 0) {
      setPlaylistItems(articles);
    }
  };

  const handleShowPlaylist = () => {
    setShowPlaylist(true);
    setShowManager(false);
  };

  return (
    <div className='feed-view flex flex-col overflow-y-auto h-full border-t-2 border-base-300'>
      {currentPlayingAudio && currentPlayingAudio.audio_url && (
        <AudioPlayer 
          currentPod={currentPlayingAudio}
          showPlaylist={handleShowPlaylist}
          playlist={playlistItems}
          setNext={handlePlayAudio}
        />
      )}
      <div className='flex flex-row overflow-y-auto flex-1'>
        {showFeedSide ? (
          <div className='w-52 p-1 bg-base-300 overflow-y-auto'>
            <ChannelList 
              key={`list-${channelList.length}`}
              channelList={channelList} 
              onShowManager={() => setShowManager(prev => !prev)} 
              onClickFeed={onClickFeed}
              onClickStar={onClickStar}
              onShowPlaylist={handleShowPlaylist}
            />
          </div>
        ) : null}
        <div className='flex-1 overflow-y-auto'>
          {showPlaylist ? (
            <Playlist 
              onSelectArticle={handlePlayAudio}
              currentPlaying={currentPlayingAudio}
              showSide={() => setShowFeedSide(prev => !prev)}
            />
          ) : showManager ? (
            <FeedManager 
              channelList={channelList} 
              handleAddFeed={handleAddFeed}
              handleDelete={handleDeleteFeed}
              onImportFeeds={handleImportFeeds}
              showSide={() => setShowFeedSide(prev => !prev)}
            />
          ) : (
            <Channel 
              channel={currentChannel} 
              isStarChannel={isStarChannel} 
              entries={currentEntries}
              loading={loading}
              showSide={() => setShowFeedSide(prev => !prev)}
              onPlayAudio={handlePlayAudio}
            />
          )}
        </div>
      </div>
    </div>
  );
}
