import AtpAgent, { AtpSessionData, CredentialSession } from "@atproto/api";

// to store active sessions
export interface AuthToken {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  active?: boolean;
  email?: string;
  status?: string;
}

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

export const getAuth = (): User => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user) as User;
};

export const getAccessToken = async (): Promise<string | null> => {
  const user = localStorage.getItem('user') ?? '{}';
  return JSON.parse(user).access ?? null;
};

export async function createSession(handle: string, pass: string, host: string) {
  let url = `https://${host}/xrpc/com.atproto.server.createSession`;
  const response = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ identifier: handle, password: pass }),
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Create Session, Response status: ${response.status}`);
  }
  const result = await response.json();
  console.log(result);
  return result as AuthToken;
}

export async function getSession(host: string, accessToken: string) {
  let url = `https://${host}/xrpc/com.atproto.server.getSession`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  // if (!response.ok) {
  //   throw new Error(`Get Seesion: Response status: ${response.status}`);
  // }

  return response.ok;
}

/** return user or throw erro */
export async function refreshSession() {
  const userJson = localStorage.getItem('user');
  const usr = userJson ? JSON.parse(userJson) as User : null;
  if (!usr) {
    throw new Error(`Need to log in`);
  }
  const host = usr.host;
  const access = usr.accessJwt;
  const refresh = usr.refreshJwt;
  const hasSession = await getSession(host, access);
  if (!hasSession) {
    const res = await refreshToken(host, refresh);
    const newUser: User = {
      ...usr,
      accessJwt: res.accessJwt,
      refreshJwt: res.refreshJwt,
    };
    return newUser;
  } else {
    return usr;
  }
}

async function refreshToken(host: string, refreshToken: string) {
  let url = `https://${host}/xrpc/com.atproto.server.refreshSession`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${refreshToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Refresh Token, Response status: ${response.status}`);
  }
  const result = await response.json();
  console.log('refresh token', result);
  return result as AuthToken;
}


export async function getAtpAgent(): Promise<AtpAgent> {
  const usr = await refreshSession();
  // Initialize agent
  const session = new CredentialSession(new URL(`https://${usr.host}`))
  const agent = new AtpAgent(session);
  await agent.resumeSession(usr as AtpSessionData);

  return agent;
}


interface ResolveService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

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
    
    console.log(`✓ DID resolved: ${did} -> ${endpoint}`);
    return endpoint;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error resolving DID ${did}:`, error.message);
      throw error;
    }
    throw new Error(`Unknown error resolving DID: ${did}`);
  }
}
