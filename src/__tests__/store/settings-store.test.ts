import { describe, test, expect, beforeEach, vi } from 'vitest';

vi.mock('@/i18n/i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

vi.mock('@/utils/time', () => ({
  initDayjs: vi.fn(),
}));

import { useSettingsStore } from '@/store/settingsStore';
import type { SystemSettings } from '@/types/settings';

function makeSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    version: 1,
    localBooksDir: '/books',
    keepLogin: false,
    autoUpload: false,
    alwaysOnTop: false,
    openBookInNewWindow: false,
    autoCheckUpdates: true,
    screenWakeLock: false,
    screenBrightness: 1,
    autoScreenBrightness: true,
    alwaysShowStatusBar: false,
    alwaysInForeground: false,
    openLastBooks: false,
    lastOpenBooks: [],
    autoImportBooksOnOpen: false,
    savedBookCoverForLockScreen: '',
    savedBookCoverForLockScreenPath: '',
    telemetryEnabled: false,
    discordRichPresenceEnabled: false,
    libraryViewMode: 'grid',
    librarySortBy: 'updated',
    librarySortAscending: false,
    libraryGroupBy: 'none',
    libraryCoverFit: 'crop',
    libraryAutoColumns: true,
    libraryColumns: 4,
    customFonts: [],
    customTextures: [],
    opdsCatalogs: [],
    metadataSeriesCollapsed: false,
    metadataOthersCollapsed: false,
    metadataDescriptionCollapsed: false,
    lastSyncedAtBooks: 0,
    lastSyncedAtConfigs: 0,
    lastSyncedAtNotes: 0,
    migrationVersion: 0,
    ...overrides,
  } as SystemSettings;
}

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: {} as SystemSettings,
      settingsDialogBookKey: '',
      isFontLayoutSettingsDialogOpen: false,
      activeSettingsItemId: null,
    });
    vi.clearAllMocks();
  });

  describe('setSettings', () => {
    test('sets the settings object', () => {
      const settings = makeSettings({ version: 42 });
      useSettingsStore.getState().setSettings(settings);

      expect(useSettingsStore.getState().settings.version).toBe(42);
    });

    test('replaces previous settings entirely', () => {
      const settings1 = makeSettings({ localBooksDir: '/old' });
      const settings2 = makeSettings({ localBooksDir: '/new' });

      useSettingsStore.getState().setSettings(settings1);
      useSettingsStore.getState().setSettings(settings2);

      expect(useSettingsStore.getState().settings.localBooksDir).toBe('/new');
    });
  });

  describe('setSettingsDialogBookKey', () => {
    test('sets the dialog book key', () => {
      useSettingsStore.getState().setSettingsDialogBookKey('book-key-123');
      expect(useSettingsStore.getState().settingsDialogBookKey).toBe('book-key-123');
    });

    test('can set to empty string', () => {
      useSettingsStore.getState().setSettingsDialogBookKey('some-key');
      useSettingsStore.getState().setSettingsDialogBookKey('');
      expect(useSettingsStore.getState().settingsDialogBookKey).toBe('');
    });
  });

  describe('setSettingsDialogOpen', () => {
    test('opens the settings dialog', () => {
      useSettingsStore.getState().setFontLayoutSettingsDialogOpen(true);
      expect(useSettingsStore.getState().isFontLayoutSettingsDialogOpen).toBe(true);
    });

    test('closes the settings dialog', () => {
      useSettingsStore.getState().setFontLayoutSettingsDialogOpen(true);
      useSettingsStore.getState().setFontLayoutSettingsDialogOpen(false);
      expect(useSettingsStore.getState().isFontLayoutSettingsDialogOpen).toBe(false);
    });
  });

  describe('setActiveSettingsItemId', () => {
    test('sets the active item id', () => {
      useSettingsStore.getState().setActiveSettingsItemId('item-1');
      expect(useSettingsStore.getState().activeSettingsItemId).toBe('item-1');
    });

    test('sets to null to clear', () => {
      useSettingsStore.getState().setActiveSettingsItemId('item-1');
      useSettingsStore.getState().setActiveSettingsItemId(null);
      expect(useSettingsStore.getState().activeSettingsItemId).toBeNull();
    });
  });
});
