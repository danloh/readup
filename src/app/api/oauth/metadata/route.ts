/**
 * OAuth Client Metadata endpoint
 * Required by ATProto OAuth servers to authorize your application
 * 
 * The client_id in your .env.local should point to this endpoint:
 * http://localhost:3000/oauth/metadata.json
 * 
 * For production:
 * https://readup.cc/oauth/metadata.json
 */

export async function GET() {
  const baseUrl = 'http://localhost:3000';

  const metadata = {
    // Required fields
    client_id: `${baseUrl}/oauth/metadata.json`,
    client_name: 'Readup',
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
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };

  return new Response(JSON.stringify(metadata), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
