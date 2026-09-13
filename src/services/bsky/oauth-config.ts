/**
 * OAuth Client Configuration
 * 
 * The client_id for ATProto OAuth must be a URL pointing to client metadata JSON.
 * This utility ensures proper configuration.
 */

/**
 * Get the OAuth client ID (metadata URL)
 * 
 * The client_id should be a URL in the format:
 * - Development: http://localhost:3000
 * - Production: https://readup.cc/oauth/metadata.json
 * 
 * @returns The client ID URL or null if not configured
 */
export function getOAuthClientId(): string {
  const configuredClientId = process.env['NEXT_PUBLIC_OAUTH_CLIENT_ID'];
  const appBaseUrl = getAppBaseUrl();
  const clientId = configuredClientId
    ? normalizeLoopbackUrl(configuredClientId)
    : appBaseUrl.startsWith('http://')
      ? appBaseUrl
      : `${appBaseUrl}/oauth/metadata.json`;
  
  if (!clientId) {
    console.warn(
      'OAuth client ID not configured. ' +
      'Set CLIENT_ID environment variable.'
    );
    return '';
  }

  // Validate that client_id is a URL
  if (!clientId.startsWith('http://') && !clientId.startsWith('https://')) {
    console.error(
      'Invalid OAuth client ID. Must be a URL starting with http:// or https://'
    );
    return '';
  }

  return clientId;
}

/**
 * Get the base URL for the application
 * Used to construct redirect URIs and other URLs
 */
export function getAppBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const { hostname, port, protocol } = window.location;
    return protocol === 'http:' && isLoopbackHostname(hostname)
      ? `http://localhost${port ? `:${port}` : ''}`
      : window.location.origin;
  }
  
  // Server-side
  const configuredUrl = process.env['NEXT_PUBLIC_APP_URL'];
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    return normalizeLoopbackUrl(url.origin);
  }

  return 'http://localhost:3000';
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function normalizeLoopbackUrl(value: string): string {
  const url = new URL(value);
  return url.protocol === 'http:' && isLoopbackHostname(url.hostname)
    ? `http://localhost${url.port ? `:${url.port}` : ''}`
    : value;
}

/**
 * Get the OAuth redirect URI
 * Must match one of the redirect_uris in the client metadata
 */
export function getOAuthRedirectUri(): string {
  return `${getAppBaseUrl()}/auth/callback`;
}

/**
 * Validate OAuth configuration
 * Call this on app startup to ensure OAuth is properly configured
 */
export function validateOAuthConfig(): boolean {
  const clientId = getOAuthClientId();
  const redirectUri = getOAuthRedirectUri();

  if (!clientId) {
    console.warn('⚠️  OAuth client ID not set');
    return false;
  }

  if (!redirectUri) {
    console.warn('⚠️  OAuth redirect URI could not be determined');
    return false;
  }

  console.log('✓ OAuth Configuration:');
  console.log(`  Client ID: ${clientId}`);
  console.log(`  Redirect URI: ${redirectUri}`);

  return true;
}
