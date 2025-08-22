import React, { memo, useEffect, useState } from "react";
import { IoMdLink, IoMdStar, IoMdStarOutline } from "react-icons/io";
import { ArticleType, dateCompare, FeedType, fmtDatetime } from "./dataAgent";
import { useEnv } from "@/context/EnvContext";

type Props = {
  channel: FeedType | null;
  isStarChannel?: boolean;
  articles: ArticleType[] | null;
  loading: boolean;
};

export function Channel(props: Props) {
  const { channel, isStarChannel, articles, loading } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center">Loading...</div>
    );
  } else if (!articles) {
    return (<></>);
  }

  return (
    <div className="flex flex-col items-between justify-center p-2">
      <div className="flex flex-row items-center justify-between p-1 bg-slate-500 rounded">
        <b className="font-bold">{channel?.title || (isStarChannel ? 'Starred' : '')}</b>
        <span className="text-info" >{articles.length}</span>
      </div>
      <ArticleList articles={articles} isInStar={isStarChannel} />
    </div>
  );
}

type ListProps = {
  articles: ArticleType[];
  isInStar?: Boolean;
};

function ArticleList(props: ListProps) {
  const { articles, isInStar } = props;

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
            isInStar={isInStar}
          />
        )}
      )}
    </div>
  );
}

type ItemProps = {
  article: ArticleType;
  isInStar?: Boolean;
};

const ArticleItem = memo(function ArticleItm(props: ItemProps) {
  const { article, isInStar } = props;
  const { envConfig } = useEnv();
  const [isStar, setIsStar] = useState(isInStar);
  const [expanded, setExpanded] = useState(false);

  const updateStar = async (article: ArticleType, toStar: Boolean) => {
    const appService = await envConfig.getAppService();
    let starArticles = await appService.loadArticles();
    if (toStar) {
      if (starArticles.findIndex(a => a.url === article.url) === -1) {
        starArticles.push(article);
      }
    } else {
      starArticles = starArticles.filter(a => a.url !== article.url);
    }
    await appService.saveArticles(starArticles);
  };

  return (
    <div className='flex flex-col items-start justify-center my-1' aria-hidden="true">
      <div 
        className="flex flex-row items-center justify-start" 
        onClick={() => setExpanded(prev => !prev)}
      >
        <h2 className="flex-1 font-bold m-1 text-xl cursor-pointer">{article.title}</h2>
      </div>
      <div className="flex flex-row items-center justify-center">
        <span className="m-1 text-sm text-info">
          {fmtDatetime(article.published || '')}
        </span>
        <a
          className="m-1"
          target="_blank"
          rel="noreferrer"
          href={article.url}
        >
          <IoMdLink size={20} />
        </a>
        <span 
          className="m-1 cursor-pointer" 
          onClick={async () => {
            await updateStar(article, !isStar);
            setIsStar(!isStar);
          }}
        >
          {isInStar 
            ? (<IoMdStar size={20} className={`${isStar ? 'text-success' : 'text-info'}`} />)
            : (<IoMdStarOutline size={20} className={`${isStar ? 'text-success' : ''}`} />)
          }
        </span>
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
    <div className="h-full p-2">
      <div
        className="content prose prose-sm"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: pageContent}}
      />
    </div>
  );
}
