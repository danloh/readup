import React, { memo, useEffect, useState } from 'react';
import { IoMdLink, IoMdStar, IoMdStarOutline } from 'react-icons/io';
import { useEnv } from '@/context/EnvContext';
import * as dataAgent from './dataAgent';
import { 
  ArticleType, dateCompare, FeedType, FeedEntry, fmtDatetime, getFavicon 
} from './dataAgent';

type Props = {
  channel: FeedType | null;
  isStarChannel?: boolean;
  entries: FeedEntry[] | null;
  loading: boolean;
};

export function Channel(props: Props) {
  const { channel, isStarChannel, entries, loading } = props;

  if (loading) {
    return (
      <div className='flex items-center justify-center'>Loading...</div>
    );
  } else if (!entries) {
    return (<></>);
  }

  return (
    <div className='flex flex-col items-between justify-center p-2'>
      <div className='flex flex-row items-center justify-between p-1 bg-slate-500 rounded'>
        <b className='font-bold'>{channel?.title || (isStarChannel ? 'Starred' : '')}</b>
        <span className='text-info' >{entries.length}</span>
      </div>
      <ArticleList articles={entries} isInStar={isStarChannel} />
    </div>
  );
}

type ListProps = {
  articles: FeedEntry[];
  isInStar?: boolean;
};

function ArticleList(props: ListProps) {
  const { articles, isInStar } = props;

  const sortedArticles = articles.length >= 2 
    ? articles.sort((n1, n2) => {
        return n2.published && n1.published 
          ? dateCompare(n2.published, n1.published)
          : 0;
      })
    : articles;

  console.log('sorted: ', sortedArticles)

  return (
    <div className=''>
      {sortedArticles.map((article: FeedEntry, idx: number) => {
        return (
          <ArticleItem
            key={`${article.link}-${idx}`}
            entry={article}
            isInStar={isInStar}
          />
        )}
      )}
    </div>
  );
}

type ItemProps = {
  entry: FeedEntry;
  isInStar?: boolean;
};

const ArticleItem = memo(function ArticleItm(props: ItemProps) {
  const { entry: article, isInStar } = props;
  const { envConfig } = useEnv();
  const [isStar, setIsStar] = useState(isInStar);
  const [expanded, setExpanded] = useState(false);

  const updateStar = async (article: FeedEntry, toStar: boolean) => {
    const appService = await envConfig.getAppService();
    let starArticles = await appService.loadArticles();
    if (toStar) {
      if (starArticles.findIndex(a => a.link === article.link) === -1) {
        starArticles.push(article);
      }
    } else {
      starArticles = starArticles.filter(a => a.link !== article.link);
    }
    await appService.saveArticles(starArticles);
  };

  return (
    <div className='flex flex-col items-start justify-center m-1'>
      <div 
        className='flex flex-row items-center justify-start' 
        onClick={() => setExpanded(prev => !prev)}
      >
        <h2 className='flex-1 text-xl text-info cursor-pointer'>{article.title}</h2>
      </div>
      <div className='flex flex-row items-center justify-center'>
        <img src={getFavicon(article.link!)} className='h-4 w-4 m-1' alt='>' loading='lazy' />
        <span className='m-1 text-sm'>
          {fmtDatetime(article.published || '')}
        </span>
        <a
          className='m-1'
          target='_blank'
          rel='noreferrer'
          href={article.link}
        >
          <IoMdLink size={20} />
        </a>
        <span 
          className='m-1 cursor-pointer' 
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
      {expanded 
        ? <ArticleView entry={article} />
        : <ArticlePreview 
            content={article.description || ''} 
            onClick={() => setExpanded(prev => !prev)}
          />
      }
    </div>
  );
});

function ArticleView({ entry } : { entry: FeedEntry; }) {
  const [pageContent, setPageContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async (entry: FeedEntry) => {
      const link = entry?.link;
      if (!link || !link.trim()) {
        return;
      }

      const res: ArticleType = await dataAgent.fetchArticle(link);
      
      const content = (res.content || entry?.description || '').replace(
        /<a[^>]+>/gi,
        (a: string) => {
          return (!/\starget\s*=/gi.test(a)) ? a.replace(/^<a\s/, `<a target='_blank'`) : a;
        }
      );

      setPageContent(content);
      setLoading(false);
    };

    if (entry?.link) {
      loadArticle(entry);
    }
  }, [entry]);

  if (loading) {
    return (
      <div className='text-center px-2 py-4 text-success'>Loading...</div>
    );
  }

  return (
    <div className='h-full p-2'>
      <div
        className='content prose prose-sm'
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: pageContent}}
      />
    </div>
  );
}

function ArticlePreview({ content, onClick } : { content: string; onClick: () => void; }) {
  const pageContent = content.replace(
    /<a[^>]+>/gi,
    (a: string) => {
      return (!/\starget\s*=/gi.test(a)) ? a.replace(/^<a\s/, `<a target='_blank'`) : a;
    }
  );

  return (
    <div className='h-full p-2' onClick={onClick}>
      <div
        className='content prose prose-sm'
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{__html: pageContent}}
      />
    </div>
  );
}
