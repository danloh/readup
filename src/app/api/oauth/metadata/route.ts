/**
 * OAuth Client Metadata endpoint
 * Required by ATProto OAuth servers to authorize your application
 * 
 * The client_id in your .env.local should point to this endpoint:
 * NEXT_PUBLIC_OAUTH_CLIENT_ID=http://localhost:3000/oauth/metadata.json
 * 
 * For production:
 * NEXT_PUBLIC_OAUTH_CLIENT_ID=https://readup.cc/oauth/metadata.json
 */

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const metadata = {
    // Required fields
    client_id: `${baseUrl}/oauth/metadata.json`,
    client_name: process.env.NEXT_PUBLIC_APP_NAME || 'Readup',
    client_uri: baseUrl,
    redirect_uris: [
      `${baseUrl}/auth/callback`,
    ],

    // Recommended fields
    logo_uri: `${baseUrl}/favicon.ico`,
    
    // Optional but recommended for trust
    tos_uri: `${baseUrl}/terms`,
    policy_uri: `${baseUrl}/privacy`,

    // Scope - ATProto OAuth scopes
    scope: 'atproto transition:generic',
  };

  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
