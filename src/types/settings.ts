import { CustomTheme } from '@/styles/themes';
import type { AISettings } from '@/services/ai/types';
import type { NotebookTab } from '@/store/notebookStore';
import type { DictionarySettings, ImportedDictionary } from '@/services/dictionaries/types';
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
  customDictionaries: ImportedDictionary[];
  dictionarySettings: DictionarySettings;
  opdsCatalogs: OPDSCatalog[];
  opdsProxy: Record<string, string>;

  /**
   * App-lock PIN. When `pinCodeEnabled` is true, the user must enter
   * a 4-digit PIN before the library/reader is rendered on app launch.
   * `pinCodeHash` is `bytesToHex(PBKDF2-SHA256(pin, hexToBytes(pinCodeSalt)))`,
   * never the plaintext PIN. Cleared together with `pinCodeEnabled = false`
   * when the user disables the lock.
   */
  pinCodeEnabled?: boolean;
  pinCodeHash?: string;
  pinCodeSalt?: string;

  aiSettings: AISettings;
  // Global read settings that apply to the reader page
  globalReadSettings: ReadSettings;
  // Global view settings that apply to all books, and can be overridden by book-specific view settings
  globalViewSettings: ViewSettings;
}
