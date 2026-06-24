import { BookConfig, BookSearchConfig, ViewSettings } from '@/types/book';

// Compare a per-book view-setting value with the global one by value, not
// reference. serializeConfig deep-clones the config first, so array/object
// settings (e.g. annotationToolbarItems) are always fresh references; a reference
// check would persist them as per-book overrides even when identical to global,
// which then shadows later global changes on reopen. Primitives short-circuit;
// the JSON compare covers arrays and plain config objects (all JSON-serializable).
const isSameViewSettingValue = (a: unknown, b: unknown): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

export const serializeConfig = (
  config: BookConfig,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): string => {
  config = JSON.parse(JSON.stringify(config));
  const viewSettings = config.viewSettings as Partial<ViewSettings>;
  const searchConfig = config.searchConfig as Partial<BookSearchConfig>;
  config.viewSettings = Object.entries(viewSettings).reduce(
    (acc: Partial<Record<keyof ViewSettings, unknown>>, [key, value]) => {
      if (!isSameViewSettingValue(globalViewSettings[key as keyof ViewSettings], value)) {
        acc[key as keyof ViewSettings] = value;
      }
      return acc;
    },
    {} as Partial<Record<keyof ViewSettings, unknown>>,
  ) as Partial<ViewSettings>;
  config.searchConfig = Object.entries(searchConfig).reduce(
    (acc: Partial<Record<keyof BookSearchConfig, unknown>>, [key, value]) => {
      if (defaultSearchConfig[key as keyof BookSearchConfig] !== value) {
        acc[key as keyof BookSearchConfig] = value;
      }
      return acc;
    },
    {} as Partial<BookSearchConfig>,
  ) as Partial<BookSearchConfig>;

  return JSON.stringify(config);
};

export const deserializeConfig = (
  str: string,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): BookConfig => {
  const config = JSON.parse(str) as BookConfig;
  const { viewSettings, searchConfig } = config;
  config.viewSettings = { ...globalViewSettings, ...viewSettings };
  config.searchConfig = { ...defaultSearchConfig, ...searchConfig };
  config.updatedAt ??= Date.now();
  return config;
};

export const compressConfig = (
  config: BookConfig,
  globalViewSettings: ViewSettings,
  defaultSearchConfig: BookSearchConfig,
): string => {
  return JSON.parse(serializeConfig(config, globalViewSettings, defaultSearchConfig));
};
