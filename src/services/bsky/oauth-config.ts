/**
 * ATProto OAuth client configuration.
 *
 * Readup is a *public* OAuth client: there is no backend holding a client
 * secret. The client is identified by a `client_id` URL pointing at a static
 * metadata document, and every token is DPoP-bound to a non-extractable key
 * that lives in the browser/webview IndexedDB. Three shapes are used:
 *
 * - `web`        hosted web app — `public/oauth/metadata.json`, redirect back
 *                to `https://readup.cc/auth/callback`.
 * - `loopback`   local web development — the spec's "localhost" client that
 *                needs no hosted metadata. The page must be served from
 *                `http://127.0.0.1:<port>`.
 * - `native`     Tauri desktop and mobile — `public/oauth/native-metadata.json`.
 *                Desktop catches the redirect on a fixed loopback port
 *                (tauri-plugin-oauth), mobile through the `cc.readup:` scheme.
 *
 * The metadata JSON files are imported (not re-typed) so the copy the client
 * validates against is byte-identical to the one the authorization server
 * fetches from readup.cc.
 */

import type { OAuthClientMetadataInput } from '@atproto/oauth-client-browser';
import webMetadata from '../../../public/oauth/metadata.json';
import nativeMetadata from '../../../public/oauth/native-metadata.json';
import { isTauriAppPlatform } from '@/services/environment';

export const OAUTH_SCOPE = 'atproto transition:generic';

/** Custom-scheme redirect (reverse-domain of the client_id host readup.cc). */
export const NATIVE_SCHEME_REDIRECT_URI = 'cc.readup:/oauth/callback';
export const LOOPBACK_CALLBACK_PATH = '/oauth/callback';
/** Must match the loopback redirect_uris listed in native-metadata.json. */
export const NATIVE_LOOPBACK_PORTS = [52741, 52742, 52743];

export type OAuthClientKind = 'web' | 'loopback' | 'native';

export interface OAuthClientConfig {
  kind: OAuthClientKind;
  clientMetadata: OAuthClientMetadataInput;
  /** `query` for native redirects (a loopback server can't see fragments). */
  responseMode: 'query' | 'fragment';
}

export function isLoopbackHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  );
}

/**
 * Loopback client_id for local development: `http://localhost` (no port) with
 * the redirect_uri and scope carried as query params.
 */
export function buildLoopbackClientMetadata(
  origin: string,
  callbackPath = '/auth/callback',
): OAuthClientMetadataInput {
  const url = new URL(origin);
  const host = url.hostname === 'localhost' ? '127.0.0.1' : url.hostname;
  const redirectUri = `http://${host}${url.port ? `:${url.port}` : ''}${callbackPath}`;
  const clientId =
    `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(OAUTH_SCOPE)}`;
  return {
    client_id: clientId,
    redirect_uris: [redirectUri as `http://127.0.0.1${string}`],
    scope: OAUTH_SCOPE,
    response_types: ['code'],
    grant_types: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_method: 'none',
    application_type: 'native',
    dpop_bound_access_tokens: true,
  };
}

function withClientIdOverride(
  metadata: OAuthClientMetadataInput,
  override: string | undefined,
): OAuthClientMetadataInput {
  return override ? { ...metadata, client_id: override } : metadata;
}

export function getOAuthClientKind(): OAuthClientKind {
  if (isTauriAppPlatform()) return 'native';
  if (typeof window !== 'undefined' && isLoopbackHostname(window.location.hostname)) {
    return 'loopback';
  }
  return 'web';
}

export function getOAuthClientConfig(kind = getOAuthClientKind()): OAuthClientConfig {
  switch (kind) {
    case 'native':
      return {
        kind,
        clientMetadata: withClientIdOverride(
          nativeMetadata as OAuthClientMetadataInput,
          process.env['NEXT_PUBLIC_OAUTH_NATIVE_CLIENT_ID'],
        ),
        responseMode: 'query',
      };
    case 'loopback':
      return {
        kind,
        clientMetadata: buildLoopbackClientMetadata(window.location.origin),
        responseMode: 'fragment',
      };
    default:
      return {
        kind,
        clientMetadata: withClientIdOverride(
          webMetadata as OAuthClientMetadataInput,
          process.env['NEXT_PUBLIC_OAUTH_CLIENT_ID'],
        ),
        responseMode: 'fragment',
      };
  }
}

export function getLoopbackRedirectUri(port: number): string {
  return `http://127.0.0.1:${port}${LOOPBACK_CALLBACK_PATH}`;
}

export function isNativeOAuthCallbackUrl(url: string): boolean {
  return url.startsWith(NATIVE_SCHEME_REDIRECT_URI);
}

/**
 * Normalize the login input. A handle or DID is passed through so the server
 * can pre-fill the account; a bare service host (or empty input) becomes an
 * https URL so it is treated as a PDS / entryway rather than a handle.
 */
export function normalizeOAuthIdentifier(input: string): string {
  const value = input.trim().replace(/^@/, '');
  if (!value) return 'https://bsky.social';
  if (/^https?:\/\//i.test(value) || value.startsWith('did:')) return value;
  // well-known entryways typed as hosts (bsky.social is also a handle!)
  if (value === 'bsky.social' || value === 'bsky.app') return 'https://bsky.social';
  return value;
}
