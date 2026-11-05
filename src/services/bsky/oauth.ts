/**
 * Serverless ATProto OAuth (public client, PKCE + PAR + DPoP) built on
 * @atproto/oauth-client-browser. Sessions, DPoP keys and pending
 * authorization state live in IndexedDB; nothing passes through a Readup
 * server.
 *
 * - web / loopback: full-page redirect, finished on /auth/callback.
 * - native (Tauri): the authorization URL opens in the system browser and the
 *   redirect is caught by a loopback listener (desktop) or the `cc.readup:`
 *   deep link (mobile), then exchanged in the webview.
 */

import {
  BrowserOAuthClient,
  TokenInvalidError,
  TokenRefreshError,
  TokenRevokedError,
  type OAuthSession,
} from '@atproto/oauth-client-browser';
import {
  getLoopbackRedirectUri,
  getOAuthClientConfig,
  isNativeOAuthCallbackUrl,
  NATIVE_LOOPBACK_PORTS,
  NATIVE_SCHEME_REDIRECT_URI,
  normalizeOAuthIdentifier,
  OAUTH_SCOPE,
} from './oauth-config';
import { eventDispatcher } from '@/utils/event';
import { openExternalUrl } from '@/utils/open';

export type { OAuthSession };

/** Native sign-in gives up if the browser never redirects back. */
const NATIVE_CALLBACK_TIMEOUT_MS = 10 * 60 * 1000;

let clientPromise: Promise<BrowserOAuthClient> | null = null;
const sessions = new Map<string, OAuthSession>();

export function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OAuth is only available in the browser'));
  }
  if (!clientPromise) {
    const { clientMetadata, responseMode } = getOAuthClientConfig();
    clientPromise = Promise.resolve(
      new BrowserOAuthClient({
        clientMetadata,
        responseMode,
        // Resolves handles -> DIDs through bsky.social's XRPC endpoint, which
        // works for any handle (a browser can't do DNS TXT lookups itself).
        handleResolver: 'https://bsky.social',
        onDelete: (sub) => {
          sessions.delete(sub);
        },
      }),
    ).catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  return clientPromise;
}

/** True when the error means the stored session is gone for good. */
export function isOAuthSessionDeadError(error: unknown): boolean {
  return (
    error instanceof TokenRefreshError ||
    error instanceof TokenRevokedError ||
    error instanceof TokenInvalidError
  );
}

function remember(session: OAuthSession): OAuthSession {
  sessions.set(session.sub, session);
  return session;
}

// ---------------------------------------------------------------------------
// Web (redirect) flow

/** Redirect to the user's authorization server. Never resolves on success. */
export async function signInWithRedirect(identifier: string): Promise<never> {
  const client = await getOAuthClient();
  return client.signInRedirect(normalizeOAuthIdentifier(identifier), { scope: OAUTH_SCOPE });
}

/** Finish the web redirect flow on /auth/callback. */
export async function handleOAuthCallback(): Promise<OAuthSession | undefined> {
  const client = await getOAuthClient();
  const params = client.readCallbackParams();
  if (!params) return undefined;
  const { session } = await client.initCallback(params);
  return remember(session);
}

// ---------------------------------------------------------------------------
// Native (Tauri) flow

interface CallbackWaiter {
  redirectUri: string;
  wait: Promise<string>;
  dispose: () => Promise<void>;
}

async function waitForLoopbackCallback(signal: AbortSignal): Promise<CallbackWaiter> {
  const { start, cancel, onUrl } = await import('@fabianlars/tauri-plugin-oauth');
  const port = await start({
    ports: NATIVE_LOOPBACK_PORTS,
    response:
      '<!doctype html><meta charset="utf-8"><title>Readup</title>' +
      '<body style="font-family:system-ui;text-align:center;padding:3em">' +
      '<h2>Signed in</h2><p>You can close this tab and return to Readup.</p></body>',
  });
  const redirectUri = getLoopbackRedirectUri(port);
  let unlisten: (() => void) | undefined;
  const wait = new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    onUrl((url) => {
      if (new URL(url).pathname === new URL(redirectUri).pathname) resolve(url);
    }).then((fn) => (unlisten = fn), reject);
  });
  return {
    redirectUri,
    wait,
    dispose: async () => {
      unlisten?.();
      await cancel(port).catch(() => {});
    },
  };
}

async function waitForDeepLinkCallback(signal: AbortSignal): Promise<CallbackWaiter> {
  let handler: ((event: CustomEvent) => void) | undefined;
  const wait = new Promise<string>((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    handler = (event: CustomEvent) => {
      const urls = (event.detail?.urls ?? []) as string[];
      const url = urls.find(isNativeOAuthCallbackUrl);
      if (url) resolve(url);
    };
    eventDispatcher.on('app-incoming-url', handler);
  });
  return {
    redirectUri: NATIVE_SCHEME_REDIRECT_URI,
    wait,
    dispose: async () => {
      if (handler) eventDispatcher.off('app-incoming-url', handler);
    },
  };
}

let nativeSignInAbort: AbortController | null = null;

export function hasPendingNativeSignIn(): boolean {
  return nativeSignInAbort !== null;
}

/**
 * Finish a native sign-in whose waiter is gone (the OS restarted the app while
 * the user was in the browser). The pending PKCE state is still in IndexedDB.
 */
export async function completeOrphanedNativeCallback(url: string): Promise<OAuthSession> {
  const client = await getOAuthClient();
  const { session } = await client.callback(new URL(url).searchParams, {
    redirect_uri: NATIVE_SCHEME_REDIRECT_URI as `https://${string}`,
  });
  return remember(session);
}

/** Abort a pending native sign-in (e.g. the user closed the dialog). */
export function cancelNativeSignIn() {
  nativeSignInAbort?.abort(new Error('Sign-in cancelled'));
  nativeSignInAbort = null;
}

/**
 * Run the full native flow and resolve with the new session.
 * @param isMobile use the custom-scheme deep link instead of a loopback port
 */
export async function signInNative(identifier: string, isMobile: boolean): Promise<OAuthSession> {
  cancelNativeSignIn();
  const abort = new AbortController();
  nativeSignInAbort = abort;
  const timer = setTimeout(
    () => abort.abort(new Error('Sign-in timed out')),
    NATIVE_CALLBACK_TIMEOUT_MS,
  );

  let waiter: CallbackWaiter | undefined;
  try {
    const client = await getOAuthClient();
    waiter = isMobile
      ? await waitForDeepLinkCallback(abort.signal)
      : await waitForLoopbackCallback(abort.signal);
    waiter.wait.catch(() => {}); // rejection is surfaced by the await below
    const redirectUri = waiter.redirectUri as `https://${string}`;

    const authUrl = await client.authorize(normalizeOAuthIdentifier(identifier), {
      scope: OAUTH_SCOPE,
      redirect_uri: redirectUri,
      signal: abort.signal,
    });
    openExternalUrl(authUrl.toString());

    const callbackUrl = new URL(await waiter.wait);
    const { session } = await client.callback(callbackUrl.searchParams, {
      redirect_uri: redirectUri,
    });
    return remember(session);
  } finally {
    clearTimeout(timer);
    if (nativeSignInAbort === abort) nativeSignInAbort = null;
    await waiter?.dispose();
  }
}

// ---------------------------------------------------------------------------
// Session access

/**
 * Load the stored session for `did`, refreshing tokens if they are about to
 * expire. Throws a token error (see {@link isOAuthSessionDeadError}) when the
 * session can no longer be used, or a network error when offline.
 */
export async function restoreOAuthSession(did: string): Promise<OAuthSession> {
  const cached = sessions.get(did);
  if (cached) return cached;
  const client = await getOAuthClient();
  return remember(await client.restore(did));
}

export async function logoutOAuthSession(did: string): Promise<void> {
  sessions.delete(did);
  const client = await getOAuthClient();
  await client.revoke(did);
}
