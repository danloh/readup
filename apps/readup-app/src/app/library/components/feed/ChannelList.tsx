import React, { JSX, useState } from "react";
import { FeedType, getFavicon } from "./dataAgent";
import { IoIosSettings, IoMdRefresh } from "react-icons/io";

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
      <div className="flex items-center justify-end">
        <div className="flex flex-end">
          <button className="cursor-pointer" onClick={refreshList}>
            <IoMdRefresh size={24} className="m-1 dark:text-white" />
          </button>
          <button className="cursor-pointer" onClick={onShowManager}>
            <IoIosSettings size={24} className="m-1 dark:text-white" />
          </button>
        </div>
      </div>
      {refreshing && (
        <div className="flex flex-col items-center justify-center">
          <span className="dark:text-white">{doneNum}/{channelList.length}</span>
        </div>
      )}
      <div className="p-1">
        {renderFeedList()}
      </div>
    </div>
  );
}
