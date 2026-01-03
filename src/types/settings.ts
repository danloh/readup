import { CustomTheme } from '@/styles/themes';
import { HighlightColor, HighlightStyle, ViewSettings } from './book';
import { OPDSCatalog } from './opds';

export type ThemeType = 'light' | 'dark' | 'auto';
export type LibraryViewModeType = 'grid' | 'list';
export type LibrarySortByType = 'title' | 'author' | 'updated' | 'created' | 'size' | 'format';

export interface ReadSettings {
  sideBarWidth: string;
  isSideBarPinned: boolean;
  notebookWidth: string;
  isNotebookPinned: boolean;
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
  librarySortBy: LibrarySortByType;
  librarySortAscending: boolean;
  opdsCatalogs: OPDSCatalog[];

  lastSyncedAtBooks: number;
  lastSyncedAtConfigs: number;
  lastSyncedAtNotes: number;

  globalReadSettings: ReadSettings;
  globalViewSettings: ViewSettings;
}
