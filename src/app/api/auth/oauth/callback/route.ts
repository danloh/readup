/**
 * OAuth callback handler for ATProto/Bluesky authentication
 * This API route receives the authorization code and exchanges it for tokens
 */

import { exchangeCodeForTokens, getUserInfoFromToken } from '@/services/bsky/oauth';
import { resolveDid } from '@/services/bsky/auth';

export async function POST(request: Request) {
  try {
    const { code, codeVerifier, redirectUri, host, clientId } = await request.json();

    // Validate required parameters
    if (!code || !codeVerifier || !redirectUri || !host || !clientId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get client secret from environment (for confidential clients)
    const clientSecret = process.env['OAUTH_CLIENT_SECRET'] || '';

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(
      code,
      host,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier
    );

    // Get user info from the access token
    const userInfo = await getUserInfoFromToken(host, tokenResponse.access_token);

    // Resolve the DID to get the PDS service endpoint
    const service = await resolveDid(userInfo.sub);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          did: userInfo.sub,
          handle: userInfo.handle,
          email: userInfo.email || '',
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn: tokenResponse.expires_in,
          tokenType: tokenResponse.token_type,
          service,
          host,
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
