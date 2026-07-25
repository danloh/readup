import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    conditions: ['development'],
  },
  optimizeDeps: {
    include: [
      '@tauri-apps/plugin-fs',
      '@tauri-apps/plugin-http',
      '@tauri-apps/api/path',
      '@tauri-apps/api/core',
      '@zip.js/zip.js',
      'franc-min',
      'iso-639-2',
      'iso-639-3',
      'js-md5',
      'uuid',
    ],
    exclude: [
      '@pdfjs/pdf.min.mjs',
    ],
  },
  test: {
    include: ['src/**/*.tauri.test.ts'],
    testTimeout: 30000,
    browser: {
      enabled: true,
      provider: webdriverio({
        hostname: '127.0.0.1',
        port: 4445,
        capabilities: {
          browserName: 'chrome',
        } as WebdriverIO.Capabilities,
      }),
      instances: [{ browser: 'chrome' }],
    },
  },
});
