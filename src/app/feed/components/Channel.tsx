import React, { memo, useEffect, useState } from 'react';
import { IoMdLink, IoMdStar, IoMdStarOutline } from 'react-icons/io';
import { useEnv } from '@/context/EnvContext';
import { mergeArrays } from '@/utils/book';
import * as dataAgent from './dataAgent';
import { 
  ArticleType, dateCompare, FeedType, fmtDatetime, getFavicon 
} from './dataAgent';
import { isWebAppPlatform } from '@/services/environment';

type Props = {
  channel: FeedType | null;
  isStarChannel?: boolean;
  entries: ArticleType[] | null;
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
    <div className='flex flex-col items-between justify-center'>
      <div className='flex flex-row items-center justify-start gap-2 p-2 bg-base-300'>
        <b className='text-info' >{entries.length}</b>
        <b className='font-bold'>{channel?.title || (isStarChannel ? 'Starred' : '')}</b>
      </div>
      <ArticleList articles={entries} isInStar={isStarChannel} />
    </div>
  );
}

type ListProps = {
  articles: ArticleType[];
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
    <div className='p-2'>
      {sortedArticles.map((article: ArticleType, idx: number) => {
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
  entry: ArticleType;
  isInStar?: boolean;
};

const ArticleItem = memo(function ArticleItm(props: ItemProps) {
  const { entry: article, isInStar } = props;
  const { envConfig } = useEnv();
  const [isStar, setIsStar] = useState(isInStar);
  const [expanded, setExpanded] = useState(false);

  const updateStar = async (article: ArticleType, toStar: boolean) => {
    const appService = await envConfig.getAppService();
    const oldArticles = await appService.loadArticles();
    // just change the status then merge to old articles
    if (toStar) {
      article.status = 'star';
    } else {
      article.status = '';
    }
    const newArticles = mergeArrays(oldArticles, [article], 'link');
    await appService.saveArticles(newArticles);
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

function ArticleView({ entry } : { entry: ArticleType; }) {
  const { envConfig } = useEnv();
  const [pageContent, setPageContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async (entry: ArticleType) => {
      const link = entry?.link;
      if (!link || !link.trim()) {
        return;
      }

      // get from cache first 
      const appService = await envConfig.getAppService();
      const localArticles = await appService.loadArticles();
      let res;
      const article = localArticles.find(a => a.link === link);
      if (article && article.content?.trim()) {
        res = article
      } else if (isWebAppPlatform()) {
        res = await dataAgent.fetchArticle(link);
        // save to loacl as cache
        const newArticle = res as ArticleType;
        const newArticles = mergeArrays(localArticles, [newArticle], 'link');
        await appService.saveArticles(newArticles);
      }

      const content = (res?.content || entry?.description || '').replace(
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
