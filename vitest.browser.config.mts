import path from 'path';
import { defineConfig } from 'vitest/config';
import { webdriverio } from '@vitest/browser-webdriverio';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// Real-browser lane: runs `*.browser.test.ts(x)` in headless Chrome for
// layout / paginator behaviour that jsdom cannot model.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      '@pdfjs': path.resolve(__dirname, 'public/vendor/pdfjs'),
      fflate: path.resolve(__dirname, 'node_modules/fflate'),
    },
  },
  // App code reads `process.env.*` (Next inlines these at build time); there
  // is no `process` in a real browser, so provide the public env statically.
  define: {
    'process.env': JSON.stringify({
      NODE_ENV: 'test',
      ...Object.fromEntries(
        Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_')),
      ),
    }),
  },
  optimizeDeps: {
    exclude: ['@pdfjs/pdf.min.mjs'],
  },
  test: {
    include: ['src/**/*.browser.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000,
    browser: {
      enabled: true,
      headless: true,
      provider: webdriverio({
        capabilities: {
          browserName: 'chrome',
          'goog:chromeOptions': {
            args: ['--headless=new', '--no-sandbox', '--disable-gpu', '--window-size=1280,900'],
          },
        } as WebdriverIO.Capabilities,
      }),
      instances: [{ browser: 'chrome' }],
    },
  },
});
