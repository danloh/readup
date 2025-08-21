import React, { memo, useEffect, useState } from "react";
import { IoMdLink, IoMdRefreshCircle } from "react-icons/io";
import { ArticleType, dateCompare, FeedType, fmtDatetime } from "./dataAgent";

type Props = {
  channel: FeedType | null;
  starChannel?: boolean;
  articles: ArticleType[] | null;
  handleRefresh: () => Promise<void>;
  loading: boolean;
  syncing: boolean;
};

export function Channel(props: Props) {
  const { 
    channel, starChannel, articles, handleRefresh, loading, syncing 
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center">'Loading'</div>
    );
  } else if (!articles) {
    return (<></>);
  }

  return (
    <div className="flex flex-col items-between justify-center">
      <div className="flex flex-row items-center justify-between p-2 bg-slate-500 rounded">
        <div className="font-bold">{channel?.title || (starChannel ? 'Starred' : '')}</div>
        {(channel) && (
          <div className="flex flex-row items-center justify-end">
            <button className="" onClick={handleRefresh}>
              <IoMdRefreshCircle size={18} className="m-1 dark:text-white" />
            </button>
          </div>
        )}
      </div>
      <ArticleList articles={articles} />
    </div>
  );
}

type ListProps = {
  articles: ArticleType[];
};

function ArticleList(props: ListProps) {
  const { articles } = props;

  const sortedArticles = articles.length >= 2 
    ? articles.sort((n1, n2) => {
        return n2.published && n1.published 
          ? dateCompare(n2.published, n1.published)
          : 0;
      })
      .sort((n1, n2) => n1.read_status - n2.read_status)
    : articles;

  // console.log("sorted: ", sortedArticles)

  return (
    <div className="">
      {sortedArticles.map((article: ArticleType, idx: number) => {
        return (
          <ArticleItem
            key={`${article.id}=${idx}`}
            article={article}
          />
        )}
      )}
    </div>
  );
}

type ItemProps = {
  article: ArticleType;
};

const ArticleItem = memo(function ArticleItm(props: ItemProps) {
  const { article } = props;
  const [expanded, setExpanded] = useState(false);

  const itemClass = `cursor-pointer flex flex-col items-start justify-center my-1 hover:bg-gray-200 dark:hover:bg-gray-800`;

  return (
    <div className={itemClass} aria-hidden="true">
      <div 
        className="flex flex-row items-center justify-start" 
        onClick={() => setExpanded(prev => !prev)}
      >
        <h2 className="flex-1 font-bold m-1 dark:text-white">{article.title}</h2>
      </div>
      <div className="flex flex-row items-center justify-center">
        <span className="m-1 pl-2 text-sm dark:text-slate-400">
          {fmtDatetime(article.published || '')}
        </span>
        <a
          className="m-1 dark:text-slate-400"
          target="_blank"
          rel="noreferrer"
          href={article.url}
        >
          <IoMdLink size={20} />
        </a>
      </div>
      <ArticleView article={article} expanded={expanded} />
    </div>
  );
});

type ViewProps = {
  article: ArticleType | null;
  expanded?: Boolean;
};

function ArticleView(props: ViewProps) {
  const { article, expanded = false } = props;
  const [pageContent, setPageContent] = useState("");

  useEffect(() => {
    if (article) {
      const content = (article.content || article.description || "").replace(
        /<a[^>]+>/gi,
        (a: string) => {
          return (!/\starget\s*=/gi.test(a)) ? a.replace(/^<a\s/, '<a target="_blank"') : a;
        }
      );

      setPageContent(content);
    }
  }, [article]);

  if (!article || !expanded) {
    return (
      <div className=""></div>
    );
  }

  return (
    <div className="h-full ">
      <div className="p-2">
        <div
          className="text-lg p-2 mt-2 content text-black dark:text-slate-400"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{__html: pageContent}}
        />
      </div>
    </div>
  );
}
