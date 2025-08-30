import React, { JSX, useState } from 'react';
import { IoIosSettings, IoIosStar } from 'react-icons/io';
import { FeedType, getFavicon } from './dataAgent';

type Props = {
  channelList: FeedType[];
  onShowManager: () => void;
  onClickFeed: (link: string) => Promise<void>;
  onClickStar: () => Promise<void>;
};

export function ChannelList(props: Props) {
  const { channelList, onShowManager, onClickFeed, onClickStar } = props;

  const [highlighted, setHighlighted] = useState<FeedType>();
  
  const renderFeedList = (): JSX.Element => {
    return (
      <>
        {channelList.map((channel: FeedType, idx: number) => {
          const { title, link } = channel;
          const activeClass = 
            `${highlighted?.link === link ? 'border-r-2 border-green-500' : ''}`;
          
          return (
            <div 
              key={`${title}-${idx}`}
              className={`m-1 flex flex-row items-center justify-between cursor-pointer ${activeClass}`}
              onClick={() => {
                onClickFeed(link);
                setHighlighted(channel);
              }}
            >
              <div className='flex flex-row items-center justify-start mr-1'>
                <img src={getFavicon(link)} className='h-4 w-4 mx-1' alt='>' loading='lazy' />
                <span className='text-sm'>{title}</span>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className='flex flex-col p-1'>
      <div 
        className='flex flex-row items-center justify-between cursor-pointer'
        onClick={onShowManager}
      >
        <div className='flex flex-row items-center justify-start'>
          <IoIosSettings size={18} className='m-1' />
          <span className='m-1'>Manage Catalog</span>
        </div>
      </div>
      <div 
        className='flex flex-row items-center justify-between cursor-pointer'
        onClick={() => {
          onClickStar();
          setHighlighted(undefined);
        }}
      >
        <div className='flex flex-row items-center justify-start'>
          <IoIosStar size={18} className='m-1 fill-yellow-500 text-yellow-500' />
          <span className='m-1'>Starred</span>
        </div>
      </div>
      {renderFeedList()}
    </div>
  );
}
