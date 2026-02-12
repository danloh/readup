import { CustomTheme } from '@/styles/themes';
import type { AISettings } from '@/services/ai/types';
import type { NotebookTab } from '@/store/notebookStore';
import { HighlightColor, HighlightStyle, ViewSettings } from './book';
import { OPDSCatalog } from './opds';

export type ThemeType = 'light' | 'dark' | 'auto';
export type LibraryViewModeType = 'grid' | 'list';
export const LibrarySortByType = {
  Title: 'title',
  Author: 'author',
  Series: 'series',
  Updated: 'updated',
  Created: 'created',
  Size: 'size',
  Format: 'format',
  Published: 'published',
} as const;

export type LibrarySortByType = (typeof LibrarySortByType)[keyof typeof LibrarySortByType];

export const LibraryGroupByType = {
  None: 'none',
  Group: 'group',
  Series: 'series',
  Author: 'author',
  Status: 'status',
} as const;

export type LibraryGroupByType = (typeof LibraryGroupByType)[keyof typeof LibraryGroupByType];
export type EnhanceGroupByType = 
  typeof LibraryGroupByType.Series | 
  typeof LibraryGroupByType.Author | 
  typeof LibraryGroupByType.Status;

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
  notebookActiveTab: NotebookTab;
  autohideCursor: boolean;
  translationProvider: string;
  translateTargetLang: string;

  highlightStyle: HighlightStyle;
  highlightStyles: Record<HighlightStyle, HighlightColor>;
  customHighlightColors: Record<HighlightColor, string>;
  customThemes: CustomTheme[];
}

export interface SystemSettings {
  version: number;
  localBooksDir: string;
  customRootDir?: string;

  keepLogin: boolean;
  autoUpload: boolean;
  alwaysOnTop: boolean;
  autoCheckUpdates: boolean;
  screenWakeLock: boolean;
  alwaysInForeground: boolean;
  alwaysShowStatusBar: boolean;
  openBookInNewWindow: boolean;
  openLastBooks: boolean;
  lastOpenBooks: string[];
  autoImportBooksOnOpen: boolean;
  telemetryEnabled: boolean;
  libraryViewMode: LibraryViewModeType;
  libraryGroupBy: LibraryGroupByType;
  librarySortBy: LibrarySortByType;
  librarySortAscending: boolean;
  opdsCatalogs: OPDSCatalog[];
  opdsProxy: Record<string, string>;

  aiSettings: AISettings;
  globalReadSettings: ReadSettings;
  globalViewSettings: ViewSettings;
}
