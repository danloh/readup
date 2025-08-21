import { useEffect, useState, useRef } from 'react';

import { ChannelList } from './ChannelList';
import { Channel } from './Channel';
import { FeedManager } from './FeedManager';
import * as dataAgent from './dataAgent';
import { ArticleType, FeedType } from './dataAgent';
import clsx from 'clsx';
import { useEnv } from '@/context/EnvContext';

export default function CatalogPage() {
  const { envConfig, appService } = useEnv();
  // channel list
  const [channelList, setChannelList] = useState<FeedType[]>([]);
  const [currentChannel, setCurrentChannel] = useState<FeedType | null>(null);
  const [currentArticles, setCurrentArticles] = useState<ArticleType[] | null>(null);
  const [currentArticle, setCurrentArticle] = useState<ArticleType | null>(null);
  const [starChannel, setStarChannel] = useState(false);
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

  const [refreshing, setRefreshing] = useState(false);
  const [doneNum, setDoneNum] = useState(0);
  const refreshChannel = async (link: string, ty: string, title: string) => {
    const res = await dataAgent.addChannel(link, ty, title);
    return res;
  };

  const refreshList = async () => {
    setRefreshing(true);
    setDoneNum(0);
    for (const channel of channelList) {
      await refreshChannel(channel.link, channel.ty, channel.title);
      setDoneNum(doneNum + 1);
    }
    setRefreshing(false);
  };

  const onShowManager = () => {
    setShowManager(!showManager);
  };

  const loadArticleList = async (link: string) => {
    const articles = await dataAgent.getArticleList(link, null, null);
    // console.log('current articles', articles, currentArticles);
    setCurrentArticles(articles);
  };

  const [loading, setLoading] = useState(false);
  const onClickFeed = async (link: string) => {
    setLoading(true);
    const clickedChannel = channelList.find(c => c.link === link);
    if (clickedChannel) {
      setCurrentChannel(clickedChannel);
      setShowManager(false);
      await loadArticleList(clickedChannel.link);
    } 
    setLoading(false);
  };

  // TODO: STAR FAVIRATE, save articles to `star.json`
  const onClickStar = async () => {
    setLoading(true);
    setCurrentChannel(null);
    setCurrentArticles(null);
    setStarChannel(true);
    setShowManager(false);
    const starArticles = await dataAgent.getArticleList(null, null, 1);
    setCurrentArticles(starArticles);
    setLoading(false);
  };

  const handleAddFeed = async (link: string, ty: string, title: string) => {
    const feeds = channelList;
    const newFeed: FeedType = {ty, title, link};
    feeds.push(newFeed);
    const appService = await envConfig.getAppService();
    setChannelList(feeds);
    await appService.saveFeeds(feeds);
  };

  const handleDeleteFeed = async (channel: FeedType) => {
    const feeds = channelList;
    feeds.filter(f => f.link !== channel.link);
    const appService = await envConfig.getAppService();
    setChannelList(feeds);
    await appService.saveFeeds(feeds);
  };

  // currentChannel and it's article list
  const [syncing, setSyncing] = useState(false);
  const handleRefresh = async () => {
    setSyncing(true);
    if (currentChannel) {
      // console.log('refresh current channel: ', currentChannel)
      await dataAgent.addChannel(currentChannel.link, currentChannel.ty, currentChannel.title);
      await loadArticleList(currentChannel.link);
    }
    setSyncing(false);
  };

  return (
    <div className='flex flex-row overflow-y-auto h-full border-t-2 border-base-300'>
      <div className='w-52 p-1 bg-base-300 overflow-y-auto'>
        <ChannelList 
          channelList={channelList} 
          refreshList={refreshList} 
          onShowManager={onShowManager} 
          onClickFeed={onClickFeed}
          onClickStar={onClickStar} 
          refreshing={refreshing}
          doneNum={doneNum}
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
            starChannel={starChannel} 
            articles={currentArticles}
            handleRefresh={handleRefresh}
            loading={loading}
            syncing={syncing}
          />
        </div>
      )}
    </div>
  );
}
