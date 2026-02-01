import { useEffect, useState, useRef } from 'react';
// import clsx from 'clsx';
import { useEnv } from '@/context/EnvContext';
import { isWebAppPlatform } from '@/services/environment';
import { mergeArrays } from '@/utils/book';
import { ChannelList } from './ChannelList';
import { Channel } from './Channel';
import { FeedManager } from './FeedManager';
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
  const isInitiating = useRef(false);

  useEffect(() => {
    if (isInitiating.current) return;
    isInitiating.current = true;
    const initFeeds = async () => {
      const appService = await envConfig.getAppService();
      setChannelList(await appService.loadFeeds());
      // setFeedLoaded(true);
    };

    initFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadFeed = async (link: string) => {
    const res = await dataAgent.fetchFeed(link);
    const articles = res.articles; 
    // console.log('current articles', res);
    if (isWebAppPlatform()) {
      // Tauri fetch, with full articles
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
    // load and filter star articles
    const appService = await envConfig.getAppService();
    const localArticles = await appService.loadArticles();
    const starArticles = localArticles.filter(a => a.status === 'star');
    setCurrentEntries(starArticles); 
    setLoading(false);
  };

  const handleAddFeed = async (link: string, ty: string, title: string) => {
    const feeds = channelList;
    const newFeed: FeedType = {ty, title, link};
    if (feeds.findIndex(f => f.link === link) === -1) {
      feeds.push(newFeed);
    }
    const appService = await envConfig.getAppService();
    setChannelList(feeds);
    await appService.saveFeeds(feeds);
  };

  const handleDeleteFeed = async (channel: FeedType) => {
    const feeds = channelList;
    const newFeeds = feeds.filter(f => f.link !== channel.link);
    const appService = await envConfig.getAppService();
    setChannelList(newFeeds);
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

    const appService = await envConfig.getAppService();
    setChannelList(feeds);
    await appService.saveFeeds(feeds);
  };

  return (
    <div className='feed-view flex flex-row overflow-y-auto h-full border-t-2 border-base-300'>
      {showFeedSide ? (
        <div className='w-52 p-1 bg-base-300 overflow-y-auto'>
          <ChannelList 
            channelList={channelList} 
            onShowManager={() => setShowManager(prev => !prev)} 
            onClickFeed={onClickFeed}
            onClickStar={onClickStar} 
          />
        </div>
      ) : null}
      {showManager ? (
        <div className='flex-1 m-1 p-2 overflow-y-auto'>
          <FeedManager 
            channelList={channelList} 
            handleAddFeed={handleAddFeed}
            handleDelete={handleDeleteFeed}
            onImportFeeds={handleImportFeeds}
          />
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto`}>
          <Channel 
            channel={currentChannel} 
            isStarChannel={isStarChannel} 
            entries={currentEntries}
            loading={loading}
            showSide={() => setShowFeedSide(prev => !prev)}
          />
        </div>
      )}
    </div>
  );
}
