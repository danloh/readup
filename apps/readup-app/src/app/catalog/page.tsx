'use client';

import React, { JSX, useState } from "react";
import { NavLayout } from '../library/page';

export const getFavicon = (url: string) => {
  const hostname = url ? new URL(url).hostname : "";
  return "https://icons.duckduckgo.com/ip3/" + hostname + ".ico";
};

export interface FeedType {
  ty: string; // podcast | rss
  id: number;
  title: string;
  link: string;
  description?: string;
  published?: string; // iso date string
}

interface NavProps {
  channelList: FeedType[];
  onClickFeed: (link: string) => Promise<void>;
};

const CatalogPage: React.FC = () => {
  const [highlighted, setHighlighted] = useState<FeedType>();
  const channelList: FeedType[] = [];
  const onClickFeed = (link: string) => { 
    console.log('click', link);
    /*TODO*/ 
  };
  
  const renderFeedList = (): JSX.Element => {
    return (
      <>
        {channelList.map((channel: FeedType, idx: number) => {
          const { title, ty, link } = channel;
          const ico = getFavicon(link);
          const activeClass = `${highlighted?.link === link ? 'border-l-2 border-green-500' : ''}`;
          
          return (
            <div 
              key={`${title}-${idx}`}
              className={`m-1 flex flex-row items-center justify-between cursor-pointer ${activeClass}`}
              onClick={() => {
                onClickFeed(link);
                setHighlighted(channel);
              }}
            >
              <div className="flex flex-row items-center justify-start mr-1">
                <img src={ico} className="h-4 w-4 mx-1" alt=">" />
                <span className="text-sm text-black dark:text-white">{title}</span>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="p-1">
        {renderFeedList()}
        <p>{'Hello Catalog'}</p>
      </div>
    </div>
  );
}

const Catalog = () => {
  return (
    <NavLayout tab={'catalog'}>
      <CatalogPage />
    </NavLayout>
  );
};

export default Catalog;
