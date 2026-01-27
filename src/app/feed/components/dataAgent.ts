import { invoke } from '@tauri-apps/api/core';
import { extract as articleExtract } from '@extractus/article-extractor';
import { extract as feedExtract } from '@extractus/feed-extractor';
import { getAPIBaseUrl, isWebAppPlatform } from '@/services/environment';

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
  articles?: FeedEntry[]; // lite articles
}

export interface FeedEntry {
  id?: string;
  link?: string;
  title?: string;
  description?: string;
  published?: string;
}

export interface ArticleType {
  title: string;
  link: string;
  description: string;
  published?: Date;
  content?: string;
  author?: string;
  image?: string;
  source?: string;
  links?: string[];
  ttr?: number;
  feed_link: string;
  audio_url: string;
  id?: string;
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
    return await fetchFeedWeb(url);
  }
  return await invoke('fetch_feed', { url }); // TODO, to modify
}

export const fetchArticle = async (url: string): Promise<ArticleType> => {
  if (isWebAppPlatform()) {
    return await fetchArticleWeb(url);
  }
  return await invoke('fetch_article', { url }); // TODO, to modify
}

export interface FeedResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  responseTime?: number;
}

const FEED_API_ENDPOINT = getAPIBaseUrl() + '/feed/proxy';

const fetchFeedWeb = async (url: string): Promise<FeedType> => {
  const response = await fetch(`${FEED_API_ENDPOINT}?url=${url}`);

  const result: FeedResponse<FeedType> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Fetch feed failed');
  }
  if (!result.data) {
    throw new Error('Fetch feed failed');
  }

  return result.data;
};

export const webFetchFeed = async (url: string): Promise<FeedType> => {
  console.log("fetch feed on web");
  const result = await feedExtract(url);
  // console.log(result)
  const entries = result.entries || [];

  const feed: FeedType = {
    ty: 'feed',
    title: result.title || '',
    link: result.link || url,
    description: result.description,
    articles: entries as FeedEntry[],
  };

  return feed;
}

const ARTICLE_API_ENDPOINT = getAPIBaseUrl() + '/feed/article';

const fetchArticleWeb = async (url: string): Promise<ArticleType> => {
  const response = await fetch(`${ARTICLE_API_ENDPOINT}?url=${url}`);

  const result: FeedResponse<ArticleType> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Fetch article failed');
  }
  if (!result.data) {
    throw new Error('Fetch article failed');
  }

  return result.data;
};

export const webFetchArticle = async (
  url: string, feedUrl?: string, 
): Promise<ArticleType> => {
  console.log("fetch article on web");

  if (!url.trim()) {
    throw Error('Invalid Url');
  }
  
  const data = await articleExtract(url);
  // console.log(data)
  if (data) {
    let newArticle: ArticleType = {
      title: data.title || '',
      link: data.url || '',
      feed_link: feedUrl || '',
      audio_url: '',
      description: data.description || '',
      published: new Date(data.published || ''),
      content: data.content || data.description || '',
      author: data.author || '',
      image: data.image || '', 
    };

    return newArticle;
  } else {
    throw Error('Failed to fetch article');
  }
}
