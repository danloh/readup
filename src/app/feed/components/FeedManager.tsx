import React, { useEffect, useState, useRef } from 'react';
import clsx from 'clsx';
import { LiaFileExportSolid, LiaFileImportSolid } from 'react-icons/lia';
import { FaHeadphones, FaMinus, FaPlus, FaRss, FaTrashAlt } from 'react-icons/fa';
import { CiMenuFries } from 'react-icons/ci';

import { useTranslation } from '@/hooks/useTranslation';
import { eventDispatcher } from '@/utils/event';
import * as dataAgent from './dataAgent';
import { FeedType } from './dataAgent';
import { exportOPML, downloadOPML, parseOPMLFile } from './opmlManager';

type Props = {
  channelList: FeedType[];
  handleAddFeed: (url: string, ty: string, title: string) => Promise<void>;
  handleDelete: (channel: FeedType) => Promise<void>;
  onImportFeeds?: (feeds: FeedType[]) => Promise<void>;
  showSide?: () => void;
};

export function FeedManager(props: Props) {
  const _ = useTranslation();
  const { channelList, handleAddFeed, handleDelete, onImportFeeds, showSide } = props;

  const [realList, setRealList] = useState<FeedType[]>(channelList);
  const [showAdd, setShowAdd] = useState(false);
  const [searchText, setSearchText] = useState<string>('');

  const [feedUrl, setFeedUrl] = useState('');
  const [feedType, setFeedType] = useState('rss');
  const [feedTitle, setFeedTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExportOPML = () => {
    try {
      const opmlContent = exportOPML(channelList, 'Readup Feeds');
      downloadOPML(opmlContent);
    } catch (error) {
      console.error('Error exporting OPML:', error);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        timeout: 2000,
        message: _('Failed to export feeds'),
      });
    }
  };

  const handleImportOPML = async () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const feeds = await parseOPMLFile(file);
      
      if (feeds.length === 0) {
        eventDispatcher.dispatch('toast', {
          type: 'warn',
          timeout: 2000,
          message: _('No feeds found in the OPML file'),
        });
        return;
      }

      // Add imported feeds to the channel list
      if (onImportFeeds) {
        await onImportFeeds(feeds);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      eventDispatcher.dispatch('toast', {
        type: 'warn',
        timeout: 2000,
        message: _('Successfully imported {{len}} feed(s)', { len: feeds.length }),
      });
    } catch (error) {
      console.error('Error importing OPML:', error);
      eventDispatcher.dispatch('toast', {
        type: 'error',
        timeout: 2000,
        message: _('Failed to import feeds. Please ensure the file is a valid OPML file'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='flex flex-col items-start justify-center p-2'>
      <div className='flex flex-row gap-2 items-center justify-start w-full mt-2'>
        <button className='btn btn-xs btn-ghost' onClick={showSide}>
          <CiMenuFries />
        </button>
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
        <div className='flex items-center justify-end gap-2'>
          <button
            className='btn btn-xs p-1'
            onClick={handleImportOPML}
            disabled={loading}
            title='Import feeds from OPML'
          >
            <LiaFileImportSolid size={18} />
          </button>
          <input
            ref={fileInputRef}
            type='file'
            accept='.opml,.xml'
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button
            className='btn btn-xs p-1'
            onClick={handleExportOPML}
            title='Export feeds as OPML'
          >
            <LiaFileExportSolid size={18} />
          </button>
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
                id='feedType1' 
                name='feedType' 
                value='Feed' 
                onChange={() => setFeedType('feed')} 
              />
              <label className='mr-4 text-sm' htmlFor='feedType1'>Feed(RSS/Atom)</label>
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
      <div className='w-full flex flex-col items-between justify-center my-4'>
        {realList.map((channel: FeedType, idx: number) => {
          return (
            <div 
              key={idx} 
              className={clsx(
                'flex items-center justify-between gap-2 p-2 rounded',
                idx / 2 === 0 ? 'bg-base-300' : 'bg-base-100',
              )}
            >
              <span className='flex items-center justify-between'>
                {channel.ty === 'podcast' 
                  ? <FaHeadphones size={12} className='mr-1 text-purple-500' /> 
                  : <FaRss size={12} className='mr-1 text-orange-500' />
                }
                <span className='text-sm'>{channel.title}</span>
              </span>
              <span className='text-sm truncate'>{channel.link}</span>
              <button 
                className='btn btn-xs btn-ghost' 
                onClick={async () => await handleDelete(channel)}
              >
                <FaTrashAlt className='fill-warning' size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  );
}
