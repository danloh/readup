/**
 * OAuth wrapper using @atproto/oauth-client-browser
 * Provides simplified OAuth 2.0 with PKCE for ATProto/Bluesky
 * 
 * Client Metadata:
 * The client_id must be a URL pointing to client metadata JSON.
 * This identifies your application to the OAuth server.
 * See /oauth/metadata endpoint for details.
 */

import { BrowserOAuthClient } from '@atproto/oauth-client-browser';
import type { OAuthSession as OAuthClientSession } from '@atproto/oauth-client';

/**
 * OAuthSession represents a user's OAuth session
 * Mapped from @atproto/oauth-client OAuthSession
 */
export interface OAuthSession {
  sub: string; // DID of the user
  handle: string; // Handle of the user
  accessToken: string; // Access token for API calls
  refreshToken?: string; // Refresh token if available
}

export interface OAuthConfig {
  clientId: string;
  host?: string; // Defaults to bsky.social
}

let oauthClient: BrowserOAuthClient | null = null;

/**
 * Map the library's OAuthSession to our OAuthSession
 */
function mapSession(session: OAuthClientSession): OAuthSession {
  return {
    sub: session.sub || session.did,
    handle: (session as any).handle || '',
    accessToken: (session as any).accessToken || '',
    refreshToken: (session as any).refreshToken,
  };
}

/**
 * Initialize the OAuth client by loading metadata from clientId URL
 * The official library fetches and validates client metadata automatically
 * @param config OAuth configuration
 * @returns Initialized OAuth client
 */
async function getOAuthClient(config: OAuthConfig): Promise<BrowserOAuthClient> {
  const clientId = config.clientId;
  
  if (!clientId) {
    throw new Error('OAuth clientId is required');
  }

  // Validate that client_id is a URL (required by ATProto OAuth spec)
  if (!clientId.startsWith('http://') && !clientId.startsWith('https://')) {
    throw new Error(
      'Invalid client_id: must be a URL pointing to client metadata. ' +
      'Example: https://readup.cc/oauth/metadata.json'
    );
  }

  // Create or return cached client
  if (!oauthClient) {
    // Load the client from the metadata URL
    oauthClient = await BrowserOAuthClient.load({
      clientId,
      allowHttp: process.env.NODE_ENV === 'development',
    });
  }

  return oauthClient;
}

/**
 * Start the OAuth authorization flow
 * Redirects user to the Bluesky authorization endpoint
 * @param config OAuth configuration
 * @param host Optional ATProto host (defaults to bsky.social)
 */
export async function startOAuthFlow(config: OAuthConfig, host?: string): Promise<void> {
  const client = await getOAuthClient(config);
  
  try {
    // Use redirect flow to send user to Bluesky
    // This will throw Promise<never> to redirect
    await client.signInRedirect(host || 'bsky.social');
  } catch (error) {
    // signInRedirect throws Promise<never> on redirect
    // If we get here, it's an actual error
    console.error('OAuth authorization error:', error);
    throw error;
  }
}

/**
 * Handle OAuth callback and restore session
 * The official library automatically processes the authorization response
 * @returns Session data if OAuth flow completed successfully
 */
export async function handleOAuthCallback(): Promise<OAuthSession | undefined> {
  if (typeof window === 'undefined') {
    throw new Error('OAuth callback can only be handled in browser');
  }

  try {
    const client = oauthClient;
    if (!client) {
      throw new Error('OAuth client not initialized');
    }

    // The init() method automatically processes login callbacks
    const result = await client.init();
    if (result?.session) {
      return mapSession(result.session);
    }
    return undefined;
  } catch (error) {
    console.error('OAuth callback error:', error);
    throw error;
  }
}

/**
 * Get current OAuth session if one exists
 * @returns Session info or null
 */
export function getOAuthSession(): OAuthSession | null {
  if (!oauthClient) return null;

  try {
    // In a real app, you'd need to restore from storage
    // For now, we handle this in completeOAuthLogin
    return null;
  } catch (error) {
    console.error('Error getting OAuth session:', error);
    return null;
  }
}

/**
 * Initialize OAuth and restore existing session
 * Call this on app startup to check for existing OAuth sessions
 */
export async function restoreOAuthSession(clientId: string): Promise<OAuthSession | undefined> {
  try {
    const client = await getOAuthClient({ clientId });
    const result = await client.initRestore();
    if (result?.session) {
      return mapSession(result.session);
    }
    return undefined;
  } catch (error) {
    console.error('Error restoring OAuth session:', error);
    return undefined;
  }
}

/**
 * Revoke an OAuth session
 * @param sub The DID of the session to revoke
 */
export async function logoutOAuthSession(sub: string): Promise<void> {
  if (!oauthClient) return;

  try {
    await oauthClient.revoke(sub);
  } catch (error) {
    console.error('Error revoking OAuth session:', error);
    throw error;
  }
}
