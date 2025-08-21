import React, { JSX, useState } from "react";
import { IoIosSettings, IoIosStar, IoMdRefresh } from "react-icons/io";
import { FeedType, getFavicon } from "./dataAgent";

type Props = {
  channelList: FeedType[];
  refreshList: () => Promise<void>;
  onShowManager: () => void;
  refreshing: boolean;
  doneNum: number;
  onClickFeed: (link: string) => Promise<void>;
  onClickStar: () => Promise<void>;
};

export function ChannelList(props: Props) {
  const { channelList, refreshList, onShowManager, onClickFeed, onClickStar, refreshing, doneNum } = props;

  const [highlighted, setHighlighted] = useState<FeedType>();
  
  const renderFeedList = (): JSX.Element => {
    return (
      <>
        {channelList.map((channel: FeedType, idx: number) => {
          const { title, link } = channel;
          const ico = getFavicon(link);
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
              <div className="flex flex-row items-center justify-start mr-1">
                <img src={ico} className="h-4 w-4 mx-1" alt=">" />
                <span className="text-sm">{title}</span>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 px-2">
        <button className="btn btn-sm btn-ghost" onClick={refreshList}>
          <IoMdRefresh size={24} className="m-1" />
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onShowManager}>
          <IoIosSettings size={24} className="m-1" />
        </button>
      </div>
      {refreshing && (
        <div className="flex flex-col items-center justify-center">
          <span className="dark:text-white">{doneNum}/{channelList.length}</span>
        </div>
      )}
      <div className="p-1">
        <div 
          className="flex flex-row items-center justify-between cursor-pointer"
          onClick={onClickStar}
        >
          <div className="flex flex-row items-center justify-start">
            <IoIosStar size={18} className="m-1 fill-yellow-500 text-yellow-500" />
            <span className="m-1">Starred</span>
          </div>
        </div>
        {renderFeedList()}
      </div>
    </div>
  );
}
