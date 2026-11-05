import { Agent, AtpAgent, AtpSessionData, AtpSessionEvent } from "@atproto/api";
import { restoreOAuthSession } from './oauth';

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
  oauth?: boolean;
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
  return JSON.parse(user).accessJwt ?? null;
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

let refreshInFlight: Promise<User> | null = null;

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
    throw new Error('Not logged in');
  }

  // Validate required fields
  if (!usr.host || !usr.accessJwt || !usr.refreshJwt) {
    throw new Error('Invalid user data - missing required authentication tokens');
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  try {
    const hasSession = await checkSession(usr.host, usr.accessJwt);
    
    if (!hasSession) {
      console.log('Current session expired, refreshing tokens...');
      if (refreshInFlight) {
        return refreshInFlight;
      }
      refreshInFlight = refreshToken(usr.host, usr.refreshJwt)
        .then((res) => {
          const newUser: User = {
            ...usr,
            accessJwt: res.accessJwt,
            refreshJwt: res.refreshJwt || usr.refreshJwt,
          };
          console.log('Session refreshed successfully');
          localStorage.setItem('user', JSON.stringify(newUser));
          // refresh tokens are single-use: the cached agent now holds a dead one
          resetAgent();
          return newUser;
        })
        .finally(() => {
          refreshInFlight = null;
        });
      return await refreshInFlight;
    }
    
    console.log('Current session is still valid');
    return usr;
  } catch (error) {
    console.error('Error on refreshing session:', error);
    if ((error as Error).message === 'ExpiredToken') {
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

// ==========================================================================
// Agent: one entry point for app-password and OAuth sessions

let cachedAgent: { key: string; agent: Agent } | null = null;

/** Drop the cached agent (call on login / logout). */
export function resetAgent() {
  cachedAgent = null;
}

function persistCredentialSession(evt: AtpSessionEvent, sess: AtpSessionData | undefined) {
  const stored = getAuth();
  if (!stored.did || stored.oauth) return;
  if ((evt === 'create' || evt === 'update') && sess && sess.did === stored.did) {
    localStorage.setItem(
      'user',
      JSON.stringify({ ...stored, accessJwt: sess.accessJwt, refreshJwt: sess.refreshJwt }),
    );
  } else if (evt === 'expired') {
    // refresh token rejected: the user has to sign in again
    resetAgent();
  }
}

/**
 * Get an authenticated agent for the signed-in user.
 *
 * - OAuth users get an `Agent` backed by the DPoP-bound OAuth session (tokens
 *   refresh transparently inside the OAuth client).
 * - App-password users get a cached `AtpAgent` whose CredentialSession
 *   refreshes on `ExpiredToken` and writes rotated tokens back to storage, so
 *   no extra `getSession` round trip is needed per call.
 *
 * Use `agent.assertDid` for the repo DID: `agent.session` only exists on
 * AtpAgent.
 */
export async function getAgent(): Promise<Agent> {
  const usr = getAuth();
  if (!usr.did) {
    throw new Error('Not logged in');
  }
  const key = `${usr.oauth ? 'oauth' : 'pwd'}:${usr.did}`;
  if (cachedAgent?.key === key) {
    return cachedAgent.agent;
  }

  let agent: Agent;
  if (usr.oauth) {
    const session = await restoreOAuthSession(usr.did);
    agent = new Agent(session);
  } else {
    if (!usr.host || !usr.accessJwt || !usr.refreshJwt) {
      throw new Error('Invalid user data - missing required authentication tokens');
    }
    const atpAgent = new AtpAgent({
      service: `https://${usr.host}`,
      persistSession: persistCredentialSession,
    });
    // resumeSession validates the access token and refreshes it when expired
    await atpAgent.resumeSession(usr as AtpSessionData);
    agent = atpAgent;
  }
  cachedAgent = { key, agent };
  return agent;
}

/** @deprecated use {@link getAgent} */
export const getAtpAgent = getAgent;

// ==========================================================
// Identity resolution (DID -> PDS endpoint + handle)

interface DidService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

interface DidDocument {
  id: string;
  alsoKnownAs?: string[];
  service?: DidService[];
}

export interface ResolvedIdentity {
  did: string;
  /** PDS endpoint, e.g. https://morel.us-east.host.bsky.network */
  pds: string;
  /** Handle claimed in the DID document (not bi-directionally verified) */
  handle?: string;
}

const identityCache = new Map<string, Promise<ResolvedIdentity>>();

function didDocumentUrl(did: string): string {
  if (did.startsWith('did:plc:')) {
    return `https://plc.directory/${did}`;
  }
  if (did.startsWith('did:web:')) {
    const host = decodeURIComponent(did.slice('did:web:'.length));
    if (host.includes(':')) {
      throw new Error(`Unsupported did:web with path or port: ${did}`);
    }
    return `https://${host}/.well-known/did.json`;
  }
  throw new Error(`Unsupported DID method: ${did}`);
}

async function fetchIdentity(did: string): Promise<ResolvedIdentity> {
  const response = await fetch(didDocumentUrl(did), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Failed to resolve DID: ${response.status} ${response.statusText}`);
  }
  const doc = (await response.json()) as DidDocument;
  const pds = doc.service?.find(
    (s) =>
      (s.id === '#atproto_pds' || s.id === `${did}#atproto_pds`) &&
      s.type === 'AtprotoPersonalDataServer',
  ) ?? doc.service?.find((s) => s.type === 'AtprotoPersonalDataServer');
  if (!pds?.serviceEndpoint) {
    throw new Error(`No PDS service endpoint found for DID: ${did}`);
  }
  const handle = doc.alsoKnownAs
    ?.find((aka) => aka.startsWith('at://'))
    ?.slice('at://'.length);
  return { did, pds: pds.serviceEndpoint.replace(/\/+$/, ''), handle };
}

/**
 * Resolve a DID (did:plc or did:web) to its PDS endpoint and handle.
 * Results are cached for the app lifetime; failures are not.
 */
export function resolveIdentity(did: string): Promise<ResolvedIdentity> {
  if (!did || !did.startsWith('did:')) {
    return Promise.reject(new Error(`Invalid DID format: ${did}`));
  }
  let pending = identityCache.get(did);
  if (!pending) {
    pending = fetchIdentity(did).catch((error) => {
      identityCache.delete(did);
      throw error;
    });
    identityCache.set(did, pending);
  }
  return pending;
}

/**
 * Resolve a DID to its PDS service endpoint
 * @throws {Error} If the DID is invalid or resolution fails
 */
export async function resolveDid(did: string): Promise<string> {
  return (await resolveIdentity(did)).pds;
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
 * @returns The profile object returned by the server
 */
export async function getProfile(
  identifier: string
): Promise<UserProfile> {
  if (!identifier?.trim()) {
    throw new Error('Identifier (did or handle) are required');
  }

  // public fetch from host's XRPC endpoint
  const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(identifier)}`;
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
