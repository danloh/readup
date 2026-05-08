import * as React from 'react';
import type { Metadata, Viewport } from 'next';
import { ViewTransitions } from 'next-view-transitions';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';
import '../styles/globals.css';

const url = 'https://readup.cc/';
const title = 'Readup: Feed & eBook Reader on AT Protocol';
const description = 'Feed and ebook reader';
const previewImage = 'https://readup.cc/icon.png'; // TODO

export const metadata: Metadata = {
  metadataBase: new URL(url),
  title: {
    default: title,
    template: '%s | Readup',
  },
  description,
  generator: 'Next.js',
  manifest: '/manifest.json',
  keywords: ['epub', 'pdf', 'ebook', 'feed', 'rss', 'reader', 'readup', 'pwa'],
  authors: [
    {
      name: 'readup',
    },
  ],
  icons: {
    icon: [{ url: '/icon.png' }, { url: '/favicon.svg' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Readup',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    url,
    title,
    description,
    images: [previewImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [previewImage],
  },
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'twitter:domain': 'readup.cc',
    'twitter:url': url,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      className={process.env['NEXT_PUBLIC_APP_PLATFORM'] === 'tauri' ? 'edge-to-edge' : ''}
    >
      <body>
        <ViewTransitions>
          <EnvProvider>
            <Providers>{children}</Providers>
          </EnvProvider>
        </ViewTransitions>
      </body>
    </html>
  );
}
