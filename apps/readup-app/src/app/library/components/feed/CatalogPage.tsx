import React, { JSX, useState } from "react";
import Image from 'next/image';

export const getFavicon = (url: string) => {
  const hostname = url ? new URL(url).hostname : "";
  return "https://icons.duckduckgo.com/ip3/" + hostname + ".ico";
};

export function dateCompare(d1: string | Date, d2: string | Date) {
  return new Date(d1).getTime() - new Date(d2).getTime();
}

export function fmtDatetime(date: string | number | Date) {
  const dt = typeof date === "number" ? date * 1000 : date;
  return new Date(dt).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export interface FeedType {
  ty: string; // podcast | rss
  id: number;
  title: string;
  link: string;
  description?: string;
  published?: string; // iso date string
}

export interface ArticleType {
  id: number;
  title: string;
  url: string;
  feed_link: string;
  audio_url: string;
  description: string;
  published?: Date;
  read_status: number;
  star_status: number;
  content?: string;
  author?: string;
  image?: string;
  source?: string;
  links?: string[];
  ttr?: number;
}

export interface PodType {
  title: string;
  url: string;
  published?: Date;
  article_url: string;
  feed_link: string;
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
                <Image src={ico} className="h-4 w-4 mx-1" alt=">" />
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
      {renderFeedList()}
    </div>
  );
}

export default CatalogPage;
