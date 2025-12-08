
export interface AuthToken {
  did: string;
  handle: string;
  accessJwt: string;
  refreshJwt: string;
  email?: string;
}

export type User = {
  host: string;
	did: string;
	handle: string;
  email: string;
	access: string;
	refresh: string;
	service: string;
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
    throw new Error(`Response status: ${response.status}`);
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

  return response.ok;
}

export async function refreshSession() {
  const userJson = localStorage.getItem('user');
  const usr = userJson ? JSON.parse(userJson) as User : null;
  if (!usr) {
    throw new Error(`Need to log in`);
  }
  const host = usr.host;
  const access = usr.access;
  const refresh = usr.refresh;
  const hasSession = await getSession(host, access);
  if (!hasSession) {
    const res = await refreshToken(host, refresh);
    const newUser: User = {
      ...usr,
      access: res.accessJwt,
      refresh: res.refreshJwt,
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
    throw new Error(`Response status: ${response.status}`);
  }
  const result = await response.json();
  console.log(result);
  return result as AuthToken;
}

interface ResolveService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

interface ResolveResp {
  id: string;
  alsoKnownAs: string[];
  service: ResolveService[]
}

export async function resolveDid(did: string): Promise<string> {
  const url = `https://plc.directory/${did}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Response status: ${response.status}`);
      return '';
    }

    const result: ResolveResp = await response.json();
    console.log(result);
    return result.service[0]?.serviceEndpoint || '';
  } catch (error: any) {
    console.error(error.message);
    return '';
  }
}
