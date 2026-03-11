/**
 * OAuth 2.0 client-side utilities for ATProto/Bluesky authentication
 * Uses one-time codes (RFC 8252) for secure authorization code flow
 */

/**
 * Configuration for OAuth client
 */
export interface OAuthConfig {
  clientId: string;
  redirectUri: string;
  host?: string; // Defaults to bsky.social
}

/**
 * OAuth state stored in sessionStorage for security
 */
interface OAuthState {
  verifier: string;
  timestamp: number;
  host: string;
}

/**
 * Generate a random code verifier for PKCE (Proof Key for Public Clients)
 * @returns Base64url encoded random string
 */
function generateCodeVerifier(): string {
  const random = new Uint8Array(32);
  crypto.getRandomValues(random);
  return btoa(String.fromCharCode(...random))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Generate code challenge from verifier using SHA-256
 * @param verifier The code verifier
 * @returns Base64url encoded SHA-256 hash
 */
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashString = String.fromCharCode(...hashArray);
  return btoa(hashString)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Store OAuth state in sessionStorage
 * @param host The ATProto host
 */
function storeOAuthState(host: string): string {
  const verifier = generateCodeVerifier();
  const state: OAuthState = {
    verifier,
    timestamp: Date.now(),
    host,
  };
  sessionStorage.setItem('oauth_state', JSON.stringify(state));
  return verifier;
}

/**
 * Retrieve and clear OAuth state from sessionStorage
 * @returns The stored OAuth state or null
 */
export function getOAuthState(): OAuthState | null {
  const stateJson = sessionStorage.getItem('oauth_state');
  if (!stateJson) return null;
  
  const state = JSON.parse(stateJson) as OAuthState;
  
  // Validate state is not too old (5 minute timeout)
  if (Date.now() - state.timestamp > 5 * 60 * 1000) {
    sessionStorage.removeItem('oauth_state');
    return null;
  }
  
  sessionStorage.removeItem('oauth_state');
  return state;
}

/**
 * Start the OAuth authorization flow
 * Redirects user to the authorization endpoint
 * @param config OAuth configuration
 */
export async function startOAuthFlow(config: OAuthConfig): Promise<void> {
  const host = config.host || 'bsky.social';
  
  // Validate config
  if (!config.clientId) {
    throw new Error('OAuth clientId is required');
  }
  if (!config.redirectUri) {
    throw new Error('OAuth redirectUri is required');
  }

  // Generate and store verifier
  const verifier = storeOAuthState(host);
  const challenge = await generateCodeChallenge(verifier);

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'atproto transition:generic',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  const authUrl = `https://${host}/oauth/authorize?${params.toString()}`;
  
  // Redirect to authorization endpoint
  window.location.href = authUrl;
}

/**
 * Extract authorization code from URL query parameters
 * @returns The authorization code or null
 */
export function getAuthorizationCode(): string | null {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (error) {
    console.error('OAuth error:', error);
    const errorDescription = params.get('error_description');
    throw new Error(
      `OAuth authorization failed: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`
    );
  }

  return code;
}

/**
 * Exchange authorization code for tokens
 * Must be called on the backend to keep client credentials secret
 * @param code The authorization code
 * @param host The ATProto host
 * @param clientId The OAuth client ID
 * @param clientSecret The OAuth client secret (backend only)
 * @param redirectUri The redirect URI
 * @returns Object with accessToken and refreshToken
 */
export async function exchangeCodeForTokens(
  code: string,
  host: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}> {
  const url = `https://${host}/oauth/token`;

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
  });

  // Note: client_secret is only included if provided (for confidential clients)
  if (clientSecret) {
    params.append('client_secret', clientSecret);
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: params.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to exchange code for tokens: ${response.status} ${response.statusText}${
          errorText ? ` - ${errorText}` : ''
        }`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network error exchanging code: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get user info from access token
 * @param host The ATProto host
 * @param accessToken The access token
 * @returns User information including did and handle
 */
export async function getUserInfoFromToken(
  host: string,
  accessToken: string
): Promise<{
  sub: string; // DID
  handle: string;
  email?: string;
  [key: string]: any;
}> {
  const url = `https://${host}/oauth/userinfo`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get user info: ${response.status} ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network error getting user info: ${error.message}`);
    }
    throw error;
  }
}
