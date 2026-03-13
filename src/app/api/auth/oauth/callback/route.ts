/**
 * OAuth callback API route
 * 
 * NOTE: This route is no longer needed with @atproto/oauth-client-browser
 * The official library handles OAuth token exchange automatically on the client side.
 * 
 * This file is kept as a reference. The actual OAuth callback happens at /auth/callback
 * 
 * If you need a backend OAuth implementation in the future, you can:
 * 1. Set OAUTH_CLIENT_SECRET in environment variables (for confidential clients)
 * 2. Implement token exchange using @atproto/oauth-client-browser's API
 */

export async function POST() {
  return new Response(
    JSON.stringify({
      error: 'This endpoint is no longer needed. OAuth is handled client-side by @atproto/oauth-client-browser',
    }),
    {
      status: 410, // Gone
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
