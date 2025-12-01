import { useEffect, useState, useRef } from 'react';
// import clsx from 'clsx';
import { useEnv } from '@/context/EnvContext';
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
  const [currentArticles, setCurrentArticles] = useState<ArticleType[] | null>(null);
  const [isStarChannel, setIsStarChannel] = useState(false);
  const [showManager, setShowManager] = useState(false);
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
    console.log('current articles', res);
    setCurrentArticles(res.articles || []);
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
    setCurrentArticles(null);
    setIsStarChannel(true);
    setShowManager(false);
    // load star articles
    const appService = await envConfig.getAppService();
    setCurrentArticles(await appService.loadArticles());
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

  return (
    <div className='feed-view flex flex-row overflow-y-auto h-full border-t-2 border-base-300'>
      <div className='w-52 p-1 bg-base-300 overflow-y-auto'>
        <ChannelList 
          channelList={channelList} 
          onShowManager={() => setShowManager(prev => !prev)} 
          onClickFeed={onClickFeed}
          onClickStar={onClickStar} 
        />
      </div>
      {showManager ? (
        <div className='flex-1 m-1 p-2 overflow-y-auto'>
          <FeedManager 
            channelList={channelList} 
            handleAddFeed={handleAddFeed}
            handleDelete={handleDeleteFeed}
          />
        </div>
      ) : (
        <div className={`flex-1 overflow-y-auto`}>
          <Channel 
            channel={currentChannel} 
            isStarChannel={isStarChannel} 
            articles={currentArticles}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
