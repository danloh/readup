import React, { useEffect, useState } from 'react';
import { CgFeed } from 'react-icons/cg';
import { FaHeadphones, FaMinus, FaPlus, FaRss, FaTrashAlt } from 'react-icons/fa';
import * as dataAgent from './dataAgent';
import { FeedType } from './dataAgent';

type Props = {
  channelList: FeedType[];
  handleAddFeed: (url: string, ty: string, title: string) => Promise<void>;
  handleDelete: (channel: FeedType) => Promise<void>;
  handleImport?: () => void;
  handleExport?: () => void;
};

export function FeedManager(props: Props) {
  const { channelList, handleAddFeed, handleDelete } = props;

  const [realList, setRealList] = useState<FeedType[]>(channelList);
  const [showAdd, setShowAdd] = useState(false);
  const [searchText, setSearchText] = useState<string>('');

  const [feedUrl, setFeedUrl] = useState('https://www.propublica.org/feeds/propublica/main');
  const [feedType, setFeedType] = useState('rss');
  const [feedTitle, setFeedTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
   setRealList(channelList);
  }, [channelList]);

  const handleLoad = async () => {
    setLoading(true);
    const res = await dataAgent.fetchFeed(feedUrl);
    // console.log('res from rust', res);
    if (!res) {
      setDescription('Cannot find any feed, please check the URL');
      return;
    }
    setFeedTitle(res.title);
    setDescription(res.description || '');
    setLoading(false);
  };

  const handleCancel = () => {
    setLoading(false);
    setConfirming(false);
    setFeedTitle('');
    setFeedUrl('');
    setDescription('');
    setShowAdd(false);
  };

  const handleSave = async () => {
    await handleAddFeed(feedUrl, feedType, feedTitle);
    setConfirming(false);
    setShowAdd(false);
  };

  const handleSearch = (txt: string) => {
    if (txt) {
      const result = channelList.filter((item) => {
        return item.title.indexOf(txt) > -1 || item.link.indexOf(txt) > -1
      })
      setRealList(result);
    } else {
      setRealList(channelList);
    }
  };

  return (
    <div className='flex flex-col items-start justify-center p-2'>
      <div className='flex flex-row gap-2 items-center justify-center w-full mt-2'>
        <button
          className='btn btn-sm'
          onClick={() => setShowAdd(!showAdd)}
        >
          {showAdd ? (<FaMinus size={18} />) : (<FaPlus size={18} />)}
        </button>
        <div className='w-full'>
          <input
            type='text'
            className='input input-xs w-full'
            placeholder='Search Feed'
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              handleSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(searchText);
              }
            }}
          />
        </div>
      </div>
      {showAdd && (
        <div className='flex flex-col w-full p-4'>
          <div className='flex flex-row items-center justify-start w-full'>
            <div className='mr-2'>URL</div>
            <div className='w-full'>
              <input
                type='text'
                className='w-full p-1 mx-2 rounded'
                placeholder='Feed URL'
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className='flex flex-row items-center justify-start w-full'>
            <div className='mr-2'>Title</div>
            <div className='w-full'>
              <input
                type='text'
                className='w-full p-1 m-2 rounded'
                placeholder='Feed Title'
                value={feedTitle}
                onChange={(e) => setFeedTitle(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <div className='flex flex-row items-center justify-start w-full'>
            <div className='mr-2'>Type</div>
            <div className='w-full flex flex-row items-center justify-start'>
              <input 
                type='radio' 
                className='m-1 text-sm'
                id='feedType0' 
                name='feedType' 
                value='OPDS' 
                onChange={() => setFeedType('opds')} 
              />
              <label className='mr-4 text-sm' htmlFor='feedType0'>OPDS</label>
              <input 
                type='radio' 
                className='m-1 text-sm'
                id='feedType1' 
                name='feedType' 
                value='RSS' 
                onChange={() => setFeedType('rss')} 
              />
              <label className='mr-4 text-sm' htmlFor='feedType1'>RSS</label>
              <input 
                type='radio' 
                className='m-1 text-sm'
                id='feedType2' 
                name='feedType' 
                value='Podcast' 
                onChange={() => setFeedType('podcast')} 
              />
              <label className='text-sm' htmlFor='feedType2'>Podcast</label>
            </div>
          </div>
          <div className='w-full m-1'>{description}</div>
          <div className='my-1 flex flex-row items-center justify-center'>
            <button className='mr-3 btn btn-xs' onClick={handleLoad}>
              {loading ? 'Loading...' : 'Load'}
            </button>
            <button className='mx-3 btn btn-xs btn-success' onClick={handleSave}>
              {confirming ? 'Saving..' : 'OK'}
            </button>
            <button className='mx-3 btn btn-xs btn-warning' onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <div className='w-full flex flex-col items-between justify-center border-t-2 border-base-300 my-4'>
        {realList.map((channel: FeedType, idx: number) => {
          return (
            <div key={idx} className='flex items-center justify-between m-1'>
              <span className='flex items-center justify-between'>
                {channel.ty === 'rss' 
                  ? <FaRss size={12} className='mr-1 text-orange-500' /> 
                  : channel.ty === 'opds' 
                    ? <CgFeed size={12} className='mr-1 text-teal-500' />
                    : <FaHeadphones size={12} className='mr-1 text-purple-500' />
                }
                <span className='text-sm'>{channel.title}</span>
              </span>
              <span className='text-sm'>{channel.link}</span>
              <button 
                className='cursor-pointer' 
                onClick={async () => await handleDelete(channel)}
              >
                <FaTrashAlt size={18} className='m-1' />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
}

// TODO: import/export OPML, EDIT FEED