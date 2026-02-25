import AtpAgent, { AtpSessionData, CredentialSession } from "@atproto/api";

/**
 * Authentication token returned from session creation or refresh
 */
export interface AuthToken {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  active?: boolean;
  email?: string;
  status?: string;
}

/**
 * User session data including authentication tokens and server information
 */
export type User = {
	did: string;
	handle: string;
	accessJwt: string;
  refreshJwt: string;
  host: string;
	service: string;
  active?: boolean;
  email?: string;
  status?: string;
};

/**
 * Retrieve stored user data from localStorage
 * @returns User data or empty User object if not found
 */
export const getAuth = (): User => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user) as User;
};

/**
 * Retrieve access token from stored user data
 * @returns Access token string or null if not found
 */
export const getAccessToken = async (): Promise<string | null> => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user).access ?? null;
};


/**
 * Create a new session with handle and app password
 * @param handle - The user's handle 
 * @param pass - The user's app password
 * @param host - The auth server host
 * @returns Authentication token with session data
 * @throws {Error} If credentials are invalid or request fails
 */
export async function createSession(
  handle: string, pass: string, host: string
): Promise<AuthToken> {
  // Validate inputs
  if (!handle?.trim()) {
    throw new Error('Handle is required');
  }
  if (!pass) {
    throw new Error('Password is required');
  }
  if (!host?.trim()) {
    throw new Error('Host is required');
  }

  const url = `https://${host}/xrpc/com.atproto.server.createSession`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ identifier: handle, password: pass }),
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Failed to create session: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const result = await response.json() as AuthToken;
    // console.log(result);
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network error creating session: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate if the current session is active and valid
 * @param host - The auth server host
 * @param accessToken - The access token to validate
 * @returns True if session is valid, false otherwise
 * @throws {Error} If network error or invalid parameters
 */
async function checkSession(host: string, accessToken: string): Promise<boolean> {
  // Validate inputs
  if (!host?.trim()) {
    throw new Error('Host is required to validate session');
  }
  if (!accessToken?.trim()) {
    throw new Error('Access token is required to validate session');
  }

  const url = `https://${host}/xrpc/com.atproto.server.getSession`;
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    return response.ok;
  } catch (error) {
    if (error instanceof TypeError) {
      console.error('Network error validating session:', error.message);
      return false;
    }
    console.error('Error validating session:', error);
    return false;
  }
}

/**
 * Refresh user session - checks if current session is valid,
 * and refreshes if necessary
 * @returns Updated user data with fresh tokens
 * @throws {Error} If user is not logged in or refresh fails
 */
export async function refreshSession(): Promise<User> {
  const userJson = localStorage.getItem('user');
  const usr = userJson ? JSON.parse(userJson) as User : null;
  
  if (!usr) {
    throw new Error('Not logged in - user data not found');
  }

  // Validate required fields
  if (!usr.host || !usr.accessJwt || !usr.refreshJwt) {
    throw new Error('Invalid user data - missing required authentication tokens');
  }

  try {
    const hasSession = await checkSession(usr.host, usr.accessJwt);
    
    if (!hasSession) {
      console.log('Current session expired, refreshing tokens...');
      const res = await refreshToken(usr.host, usr.refreshJwt);
      const newUser: User = {
        ...usr,
        accessJwt: res.accessJwt,
        refreshJwt: res.refreshJwt,
      };
      console.log('Session refreshed successfully');
      localStorage.setItem('user', JSON.stringify(newUser));
      return newUser;
    }
    
    console.log('Current session is still valid');
    return usr;
  } catch (error) {
    console.error('Error on refreshing session:', error);
    if ((error as any).message == 'ExpiredToken') {
      localStorage.removeItem('user');
    }
    throw error;
  }
}

/**
 * Refresh authentication tokens using a refresh token
 * @param host - The auth server host
 * @param refreshToken - The refresh token to use
 * @returns New authentication tokens
 * @throws {Error} If refresh fails
 */
async function refreshToken(host: string, refreshToken: string): Promise<AuthToken> {
  // Validate inputs
  if (!host?.trim()) {
    throw new Error('Host is required for token refresh');
  }
  if (!refreshToken?.trim()) {
    throw new Error('Refresh token is required');
  }

  const url = `https://${host}/xrpc/com.atproto.server.refreshSession`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Authorization": `Bearer ${refreshToken}` },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorJson = await response.json();
      throw new Error(errorJson.error || 'unkonwn error');
    }

    const result = await response.json() as AuthToken;
    // console.log('refresh token', result);
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network error refreshing token: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Get or create an AtpAgent with current user session
 * @returns Initialized AtpAgent with active session
 * @throws {Error} If user is not logged in or session refresh fails
 */
export async function getAtpAgent(): Promise<AtpAgent> {
  const usr = await refreshSession();
  // Initialize agent
  const session = new CredentialSession(new URL(`https://${usr.host}`))
  const agent = new AtpAgent(session);
  await agent.resumeSession(usr as AtpSessionData);

  return agent;
}

// ==========================================================
// resolve Did manually 

/**
 * Service information from DID resolution
 */
interface ResolveService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/**
 * Response from DID resolution containing service endpoints
 */
interface ResolveResp {
  id: string;
  alsoKnownAs: string[];
  service: ResolveService[];
}

// Cache for resolved DIDs to avoid repeated requests
const didCache = new Map<string, string>();

/**
 * Resolve a DID to its PDS service endpoint
 * 
 * @param did - The DID to resolve (must start with 'did:')
 * @returns The PDS service endpoint URL
 * @throws {Error} If the DID is invalid or resolution fails
 */
export async function resolveDid(did: string): Promise<string> {
  // Validate DID format
  if (!did || !did.startsWith('did:')) {
    throw new Error(`Invalid DID format: ${did}`);
  }

  // Check cache first
  if (didCache.has(did)) {
    return didCache.get(did)!;
  }

  const url = `https://plc.directory/${did}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to resolve DID: ${response.status} ${response.statusText}`);
    }

    const result: ResolveResp = await response.json();
    
    // Find the AtprotoPersonalDataServer service
    const pdsService = result.service?.find(
      (service) => service.type === 'AtprotoPersonalDataServer'
    );

    if (!pdsService?.serviceEndpoint) {
      throw new Error(`No PDS service endpoint found for DID: ${did}`);
    }

    const endpoint = pdsService.serviceEndpoint;
    
    // Cache the result
    didCache.set(did, endpoint);
    
    // console.log(`✓ DID resolved: ${did} -> ${endpoint}`);
    return endpoint;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error resolving DID ${did}:`, error.message);
      throw error;
    }
    throw new Error(`Unknown error resolving DID: ${did}`);
  }
}


// ============================================================================
// ============ Get User Profile ==============================================

export type UserProfile = {
	did: string;
	handle: string;
	displayName?: string;
  description?: string;
  banner?: string;
	avatar?: string;
};

/**
 * Get a user's profile by DID or handle.
 * @param identifier - DID or handle 
 * @param service - pds url of user
 * @returns The profile object returned by the server
 */
export async function getProfile(
  identifier: string, service: string
): Promise<UserProfile> {
  if (!identifier?.trim() || !service.trim()) {
    throw new Error('Identifier (did or handle) and service are required');
  }

  // public fetch from host's XRPC endpoint
  const url = `https://api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${identifier}`;
  try {
    const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error(`Failed to get profile: ${resp.status} ${resp.statusText}${errText || ''}`);
    }
    const result = await resp.json();
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Network error fetching profile: ${error.message}`);
    }
    throw error;
  }
}
