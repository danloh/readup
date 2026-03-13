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
 * - Development: http://localhost:3000/oauth/metadata.json
 * - Production: https://readup.cc/oauth/metadata.json
 * 
 * @returns The client ID URL or null if not configured
 */
export function getOAuthClientId(): string {
  const clientId = process.env['NEXT_PUBLIC_OAUTH_CLIENT_ID'];
  
  if (!clientId) {
    console.warn(
      'OAuth client ID not configured. ' +
      'Set NEXT_PUBLIC_OAUTH_CLIENT_ID environment variable.'
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
    // Client-side
    return window.location.origin;
  }
  
  // Server-side
  return process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000';
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
