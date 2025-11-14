
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
  });
  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
    return;
  }
  const result = await response.json();
  console.log(result);
  return result as AuthToken;
}

export async function getSession(host: string, accessToken: string) {
  let url = `https://${host}/xrpc/com.atproto.server.getSession`;
  const response = await fetch(url, {
    method: "GET",
    headers: {"Authorization": `Bearer ${accessToken}`,},
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
    return;
  }
  const result = await response.json();
  console.log(result);
  return result;
}

export async function refreshSession(host: string, refreshToken: string) {
  let url = `https://${host}/xrpc/com.atproto.server.refreshSession`;
  const response = await fetch(url, {
    method: "POST",
    headers: {"Authorization": `Bearer ${refreshToken}`},
  });

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`);
    return;
  }
  const result = await response.json();
  console.log(result);
  return result as AuthToken;
}

export async function resolveDid(did: string): Promise<string> {
  const url = `https://plc.directory/${did}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

    const result = await response.json();
    console.log(result);
    return 'service';  // TODO
  } catch (error: any) {
    console.error(error.message);
    return '';
  }
}
