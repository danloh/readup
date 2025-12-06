import { invoke } from '@tauri-apps/api/core';
import { extract as articleExtract } from '@extractus/article-extractor';
import { extract as feedExtract } from '@extractus/feed-extractor';
import { isWebAppPlatform } from '@/services/environment';

export const getFavicon = (url: string) => {
  const hostname = url ? new URL(url).hostname : '';
  return 'https://icons.duckduckgo.com/ip3/' + hostname + '.ico';
};

export function dateCompare(d1: string | Date, d2: string | Date) {
  return new Date(d1).getTime() - new Date(d2).getTime();
}

export function fmtDatetime(date: string | number | Date) {
  const dt = typeof date === 'number' ? date * 1000 : date;
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
  ty: string; // podcast | rss | atom | opds
  title: string;
  link: string;
  description?: string;
  published?: string; // iso date string
  articles?: ArticleType[]; // cache the articles
}

export interface ArticleType {
  title: string;
  url: string;
  feed_link: string;
  audio_url: string;
  description: string;
  published?: Date;
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

export const fetchFeed = async (url: string): Promise<FeedType> => {
  if (isWebAppPlatform()) {
    return await webFetchFeed(url);
  }
  return await invoke('fetch_feed', { url });
}

export const webFetchFeed = async (url: string): Promise<FeedType> => {
  console.log("fetch feed on web");
  const result = await feedExtract(url);
  console.log(result)
  const entries = result.entries || [];
  let articles = [];
  for (const entry of entries) {
    const articleUrl = entry.link;
    if (articleUrl && articleUrl.trim()) {
      const data = await articleExtract(articleUrl);
      console.log(data)
      if (data) {
        let newArticle: ArticleType = {
          title: data.title || '',
          url: data.url || '',
          feed_link: result.link || url,
          audio_url: '',
          description: data.description || '',
          published: new Date(data.published  || ''),
          content: data.content || data.description || '',
          author: data.author || '',
          image: data.image || '', 
        };
        articles.push(newArticle);
      }
    }
  }

  const feed: FeedType = {
    ty: 'feed',
    title: result.title || '',
    link: result.link || url,
    description: result.description,
    articles,
  };

  return feed;
}
