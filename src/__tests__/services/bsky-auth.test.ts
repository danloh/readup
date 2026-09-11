import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, refreshSession } from '@/services/bsky/auth';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const storedUser = {
  did: 'did:plc:test',
  handle: 'test.bsky.social',
  accessJwt: 'expired-access-token',
  refreshJwt: 'current-refresh-token',
  host: 'bsky.social',
  service: 'https://pds.example.com',
};

describe('Bluesky authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
  });

  it('reads the stored accessJwt', async () => {
    localStorage.setItem('user', JSON.stringify(storedUser));

    await expect(getAccessToken()).resolves.toBe('expired-access-token');
  });

  it('refreshes and persists the rotated session tokens', async () => {
    localStorage.setItem('user', JSON.stringify(storedUser));
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessJwt: 'new-access-token',
            refreshJwt: 'new-refresh-token',
          }),
          { status: 200 },
        ),
      );

    await expect(refreshSession()).resolves.toMatchObject({
      accessJwt: 'new-access-token',
      refreshJwt: 'new-refresh-token',
    });
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({
      accessJwt: 'new-access-token',
      refreshJwt: 'new-refresh-token',
    });
  });

  it('shares one refresh request when sessions expire concurrently', async () => {
    localStorage.setItem('user', JSON.stringify(storedUser));
    mockFetch
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessJwt: 'new-access-token' }), { status: 200 }));

    const firstRefresh = refreshSession();
    const secondRefresh = refreshSession();

    await expect(Promise.all([firstRefresh, secondRefresh])).resolves.toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});