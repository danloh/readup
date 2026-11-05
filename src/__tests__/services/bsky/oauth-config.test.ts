import { describe, expect, it } from 'vitest';
import nativeMetadata from '../../../../public/oauth/native-metadata.json';
import webMetadata from '../../../../public/oauth/metadata.json';
import {
  buildLoopbackClientMetadata,
  getLoopbackRedirectUri,
  getOAuthClientConfig,
  isNativeOAuthCallbackUrl,
  NATIVE_LOOPBACK_PORTS,
  NATIVE_SCHEME_REDIRECT_URI,
  normalizeOAuthIdentifier,
  OAUTH_SCOPE,
} from '@/services/bsky/oauth-config';

describe('OAuth client config', () => {
  it('treats empty input and the bsky.social host as the Bluesky entryway', () => {
    expect(normalizeOAuthIdentifier('')).toBe('https://bsky.social');
    expect(normalizeOAuthIdentifier('  bsky.social ')).toBe('https://bsky.social');
  });

  it('passes handles, DIDs and service URLs through', () => {
    expect(normalizeOAuthIdentifier('@alice.bsky.social')).toBe('alice.bsky.social');
    expect(normalizeOAuthIdentifier('did:plc:abc')).toBe('did:plc:abc');
    expect(normalizeOAuthIdentifier('https://pds.example.com')).toBe('https://pds.example.com');
  });

  it('builds a spec-compliant loopback client for local development', () => {
    const metadata = buildLoopbackClientMetadata('http://localhost:3000');
    // client_id host must be exactly "localhost" with no port
    expect(metadata.client_id!.startsWith('http://localhost?')).toBe(true);
    // redirect must use the loopback IP, not "localhost"
    expect(metadata.redirect_uris).toEqual(['http://127.0.0.1:3000/auth/callback']);
    const params = new URL(metadata.client_id!).searchParams;
    expect(params.get('redirect_uri')).toBe('http://127.0.0.1:3000/auth/callback');
    expect(params.get('scope')).toBe(OAUTH_SCOPE);
  });

  it('native metadata lists every loopback port and the custom scheme', () => {
    expect(nativeMetadata.application_type).toBe('native');
    expect(nativeMetadata.redirect_uris).toContain(NATIVE_SCHEME_REDIRECT_URI);
    for (const port of NATIVE_LOOPBACK_PORTS) {
      expect(nativeMetadata.redirect_uris).toContain(getLoopbackRedirectUri(port));
    }
    // custom scheme must be the reverse domain of the client_id host
    const host = new URL(nativeMetadata.client_id).hostname;
    expect(NATIVE_SCHEME_REDIRECT_URI.split(':')[0]).toBe(host.split('.').reverse().join('.'));
  });

  it('metadata documents are public DPoP clients on the same scope', () => {
    for (const metadata of [webMetadata, nativeMetadata]) {
      expect(metadata.token_endpoint_auth_method).toBe('none');
      expect(metadata.dpop_bound_access_tokens).toBe(true);
      expect(metadata.scope).toBe(OAUTH_SCOPE);
      expect(metadata.client_id!.startsWith(metadata.client_uri)).toBe(true);
    }
  });

  it('native client uses query response mode', () => {
    expect(getOAuthClientConfig('native').responseMode).toBe('query');
    expect(getOAuthClientConfig('web').clientMetadata.client_id).toBe(webMetadata.client_id);
  });

  it('recognises native callback URLs', () => {
    expect(isNativeOAuthCallbackUrl('cc.readup:/oauth/callback?code=x&state=y')).toBe(true);
    expect(isNativeOAuthCallbackUrl('readup://share?id=1')).toBe(false);
  });
});
