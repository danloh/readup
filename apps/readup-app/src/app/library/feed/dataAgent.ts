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
  return await invoke('fetch_feed', { url })
}
