import { invoke } from '@tauri-apps/api/core';

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

type FeedResult = {
  channel: FeedType;
  articles: ArticleType[];
};

export const fetchFeed = async (url: string): Promise<FeedResult> => {
  return await invoke('fetch_feed', { url })
}

export const addChannel = async (
  url: string, ty: string, title: string | null
): Promise<number> => {
  return await invoke('add_channel', { url, ty, title })
}

export const importChannels = async (list: string[]) => {
  return await invoke('import_channels', { list })
}

export const getChannels = async (): Promise<FeedType[]> => {
  return await invoke('get_channels')
}

export const deleteChannel = async (link: string) => {
  return await invoke('delete_channel', { link })
};

export const getArticleList = async (
  feedLink: string | null, 
  readStatus: number | null,
  starStatus: number | null,
) : Promise<ArticleType[]> => {
  return await invoke('get_articles', { feedLink, readStatus, starStatus })
}

export const getArticleByUrl = async (url: string): Promise<ArticleType | null> => {
  return await invoke('get_article_by_url', { url })
}

export const getUnreadNum = async (): Promise<{ [key: string]: number }> => {
  return await invoke('get_unread_num')
}

export const updateArticleStarStatus = async (
  articleUrl: string, 
  star_status: number, // 0 || 1
): Promise<number> => {
  return await invoke('update_article_star_status', {
    url: articleUrl,
    status: star_status,
  })
}

export const updateArticleReadStatus = async (
  articleUrl: string, 
  read_status: number,
): Promise<number> => {
  return await invoke('update_article_read_status', {
    url: articleUrl,
    status: read_status,
  })
}

export const updateAllReadStatus = async (
  feedLink: string, 
  readStatus: number,
): Promise<number> => {
  return await invoke('update_all_read_status', { feedLink, readStatus })
}
