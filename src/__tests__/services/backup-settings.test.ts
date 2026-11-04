import { describe, it, expect } from 'vitest';
import {
  BACKUP_SETTINGS_BLACKLIST,
  BACKUP_SETTINGS_CREDENTIAL_FIELDS,
  sanitizeSettingsForBackup,
  mergeRestoredSettings,
} from '@/services/backupService';
import { SystemSettings } from '@/types/settings';

/**
 * Tests for global-settings backup support (issue #4098):
 * - sanitizeSettingsForBackup strips device-specific / sync-bookkeeping
 *   fields and (by default) credentials before writing settings.json.
 * - mergeRestoredSettings deep-merges a restored snapshot onto the
 *   current device settings, preserving stripped fields.
 */

/** Read an arbitrary (possibly stripped) field as a plain record. */
const rec = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;

function makeSettings(overrides: Partial<SystemSettings> = {}): SystemSettings {
  return {
    version: 5,
    migrationVersion: 3,
    localBooksDir: '/Users/me/Books',
    customRootDir: '/Users/me/readup',
    keepLogin: true,
    screenBrightness: 0.7,
    autoScreenBrightness: false,
    lastOpenBooks: ['book-1', 'book-2'],
    savedBookCoverForLockScreen: 'cover',
    savedBookCoverForLockScreenPath: '/Users/me/cover.png',
    libraryViewMode: 'grid',
    librarySortBy: 'title',
    libraryColumns: 4,
    lastSyncedAtBooks: 1234,
    lastSyncedAtConfigs: 1235,
    lastSyncedAtNotes: 1236,
    aiSettings: {
      enabled: true,
      provider: 'ollama',
      ollamaBaseUrl: 'http://localhost',
      aiGatewayApiKey: 'ai-secret-key',
    },
    globalReadSettings: {
      sideBarWidth: '20%',
      customThemes: [{ name: 'mytheme' }],
    },
    globalViewSettings: {
      userStylesheet: 'body { color: red }',
      uiLanguage: 'en',
    },
    ...overrides,
  } as unknown as SystemSettings;
}

describe('sanitizeSettingsForBackup - blacklist', () => {
  it('strips device-specific filesystem paths', () => {
    const out = rec(sanitizeSettingsForBackup(makeSettings()));
    expect(out['localBooksDir']).toBeUndefined();
    expect(out['customRootDir']).toBeUndefined();
    expect(out['savedBookCoverForLockScreenPath']).toBeUndefined();
  });

  it('strips sync cursors', () => {
    const out = rec(sanitizeSettingsForBackup(makeSettings()));
    expect(out['lastSyncedAtBooks']).toBeUndefined();
    expect(out['lastSyncedAtConfigs']).toBeUndefined();
    expect(out['lastSyncedAtNotes']).toBeUndefined();
  });

  it('strips transient runtime state', () => {
    const out = rec(sanitizeSettingsForBackup(makeSettings()));
    expect(out['lastOpenBooks']).toBeUndefined();
    expect(out['screenBrightness']).toBeUndefined();
  });

  it('strips schema versioning fields', () => {
    const out = rec(sanitizeSettingsForBackup(makeSettings()));
    expect(out['version']).toBeUndefined();
    expect(out['migrationVersion']).toBeUndefined();
  });

  it('keeps preferences, layout and customization fields', () => {
    const out = sanitizeSettingsForBackup(makeSettings());
    expect(out.keepLogin).toBe(true);
    expect(out.libraryViewMode).toBe('grid');
    expect(out.globalReadSettings.customThemes).toEqual([{ name: 'mytheme' }]);
    expect(out.globalViewSettings.userStylesheet).toBe('body { color: red }');
  });

  it('does not mutate the input settings', () => {
    const input = makeSettings();
    const snapshot = JSON.stringify(input);
    sanitizeSettingsForBackup(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('every blacklisted path is a string', () => {
    expect(BACKUP_SETTINGS_BLACKLIST.every((p) => typeof p === 'string')).toBe(true);
  });
});

describe('sanitizeSettingsForBackup - credentials', () => {
  it('strips credentials by default', () => {
    const out = sanitizeSettingsForBackup(makeSettings());
    expect(rec(out.aiSettings)['aiGatewayApiKey']).toBeUndefined();
  });

  it('keeps credentials when includeCredentials is true', () => {
    const out = sanitizeSettingsForBackup(makeSettings(), { includeCredentials: true });
    expect(rec(out.aiSettings)['aiGatewayApiKey']).toBe('ai-secret-key');
  });

  it('still strips blacklist fields even when credentials are included', () => {
    const out = rec(sanitizeSettingsForBackup(makeSettings(), { includeCredentials: true }));
    expect(out['localBooksDir']).toBeUndefined();
  });

  it('every credential path is a string', () => {
    expect(BACKUP_SETTINGS_CREDENTIAL_FIELDS.every((p) => typeof p === 'string')).toBe(true);
  });
});

describe('mergeRestoredSettings', () => {
  it('overrides current scalar values with the backup snapshot', () => {
    const current = makeSettings({ libraryViewMode: 'list' });
    const backup = sanitizeSettingsForBackup(makeSettings({ libraryViewMode: 'grid' }));
    const merged = mergeRestoredSettings(current, backup);
    expect(merged.libraryViewMode).toBe('grid');
  });

  it('replaces arrays wholesale rather than concatenating', () => {
    const current = makeSettings({
      globalReadSettings: {
        customThemes: [{ name: 'device-theme-a' }, { name: 'device-theme-b' }],
      } as SystemSettings['globalReadSettings'],
    });
    const backup = sanitizeSettingsForBackup(
      makeSettings({
        globalReadSettings: {
          customThemes: [{ name: 'restored-theme' }],
        } as SystemSettings['globalReadSettings'],
      }),
    );
    const merged = mergeRestoredSettings(current, backup);
    expect(merged.globalReadSettings.customThemes).toEqual([{ name: 'restored-theme' }]);
  });

  it('does not mutate the current or backup objects', () => {
    const current = makeSettings();
    const backup = sanitizeSettingsForBackup(makeSettings({ libraryViewMode: 'list' }));
    const currentSnapshot = JSON.stringify(current);
    const backupSnapshot = JSON.stringify(backup);
    mergeRestoredSettings(current, backup);
    expect(JSON.stringify(current)).toBe(currentSnapshot);
    expect(JSON.stringify(backup)).toBe(backupSnapshot);
  });
});
