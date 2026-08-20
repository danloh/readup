import { AppService } from '@/types/system';
import { READUP_WEB_BASE_URL } from './constants';

declare global {
  interface Window {
    __READUP_CLI_ACCESS?: boolean;
  }
}

export const isTauriAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri';
export const isWebAppPlatform = () => process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'web';
export const hasCli = () => window.__READUP_CLI_ACCESS === true;
export const isPWA = () => window.matchMedia('(display-mode: standalone)').matches;
export const getBaseUrl = () => process.env['NEXT_PUBLIC_API_BASE_URL'] ?? READUP_WEB_BASE_URL;
export const getNodeBaseUrl = () => process.env['NEXT_PUBLIC_NODE_BASE_URL'];

export const isMacPlatform = () =>
  typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const getCommandPaletteShortcut = () => (isMacPlatform() ? '⌘⇧P' : 'Ctrl+Shift+P');

// Dev API only in development mode and web platform
// with command `pnpm dev-web`
// for production build or tauri app use the production Web API
export const getAPIBaseUrl = () =>
  process.env['NODE_ENV'] === 'development' && isWebAppPlatform() ? '/api' : `${getBaseUrl()}/api`;

const isWebDevMode = () => process.env['NODE_ENV'] === 'development' && isWebAppPlatform();
// For Node.js API that currently not supported in some edge runtimes
export const getNodeAPIBaseUrl = () => (isWebDevMode() ? '/api' : `${getNodeBaseUrl()}/api`);

export interface EnvConfigType {
  getAppService: () => Promise<AppService>;
}

let nativeAppService: AppService | null = null;
const getNativeAppService = async () => {
  if (!nativeAppService) {
    const { NativeAppService } = await import('@/services/nativeAppService');
    // Publish the singleton only after `init` resolves. Assigning first meant a
    // failed init left a half-built service cached forever: every later caller
    // got it back without re-running init, and `getInitializedAppService`
    // handed synchronous callers an object whose paths were never resolved.
    const service = new NativeAppService();
    await service.init();
    nativeAppService = service;
  }
  return nativeAppService;
};

let webAppService: AppService | null = null;
const getWebAppService = async () => {
  if (!webAppService) {
    const { WebAppService } = await import('@/services/webAppService');
    const service = new WebAppService();
    await service.init();
    webAppService = service;
  }
  return webAppService;
};

const environmentConfig: EnvConfigType = {
  getAppService: async () => {
    if (isTauriAppPlatform()) {
      return getNativeAppService();
    } else {
      return getWebAppService();
    }
  },
};

/**
 * Synchronously returns the app service if it has already been created by
 * {@link environmentConfig.getAppService}; null before first init. The async
 * getter is preferred everywhere — use this only from synchronous code paths
 * that run well after startup (e.g. capability checks during reader render),
 * where the singleton is guaranteed to exist.
 */
export const getInitializedAppService = (): AppService | null => nativeAppService ?? webAppService;

export default environmentConfig;
