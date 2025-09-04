import "@milkdown/crepe/theme/common/style.css";
import { AppProps } from 'next/app';
import Head from 'next/head';
import { EnvProvider } from '@/context/EnvContext';
import Providers from '@/components/Providers';
// import "@milkdown/crepe/theme/frame.css";
import '../styles/globals.css';
// import '../styles/crepe.css';
// import '../styles/editor.css';
// import '../styles/prosemirror.css';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta
          name='viewport'
          content='minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover'
        />
        <meta name='application-name' content='Readup' />
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='default' />
        <meta name='apple-mobile-web-app-title' content='Readup' />
        <meta name='description' content='Readup is an eBook reader' />
        <meta name='format-detection' content='telephone=no' />
        <meta name='mobile-web-app-capable' content='yes' />
        <meta name='theme-color' content='white' />
        <link rel='manifest' href='/manifest.json' />
      </Head>
      <EnvProvider>
        <Providers>
          <Component {...pageProps} />
        </Providers>
      </EnvProvider>
    </>
  );
}

export default MyApp;
