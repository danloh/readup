import { NextRequest, NextResponse } from 'next/server';
import { isBlockedHost } from '@/utils/network';

/**
 * Fetch a feed document on behalf of the web build (browsers can't read most
 * feeds directly because of CORS) and return the raw bytes. Parsing happens on
 * the client so web and native apps share one parser.
 */

const MAX_REDIRECTS = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

const FEED_ACCEPT =
  'application/feed+json, application/json;q=0.9, application/atom+xml, application/rss+xml, application/rdf+xml, application/xml;q=0.8, text/xml;q=0.8, */*;q=0.5';

// `next dev` runs on the developer's machine, where a LAN feed is a normal
// test target, so the host blocklist only applies to deployed builds.
const isPrivateHostAllowed = () => process.env.NODE_ENV === 'development';

const errorResponse = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

const checkTarget = (url: URL): string | null => {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'Unsupported URL scheme';
  if (!isPrivateHostAllowed() && isBlockedHost(url.hostname)) return 'URL host is not allowed';
  return null;
};

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url');
  if (!raw) {
    return errorResponse('Missing URL parameter. Usage: /api/feed/proxy?url=FEED_URL', 400);
  }
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return errorResponse('Invalid URL format', 400);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Follow redirects by hand so the host check runs on every hop.
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const blocked = checkTarget(target);
      if (blocked) return errorResponse(blocked, 403);
      response = await fetch(target, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: FEED_ACCEPT, 'User-Agent': 'Readup/1.0 (Feed Reader)' },
      });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        target = new URL(location, target);
        continue;
      }
      break;
    }
    if (!response || (response.status >= 300 && response.status < 400)) {
      return errorResponse('Too many redirects', 502);
    }
    if (!response.ok) {
      return errorResponse(`Upstream responded with HTTP ${response.status}`, 502);
    }
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BYTES) return errorResponse('Feed is too large', 413);

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_BYTES) return errorResponse('Feed is too large', 413);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return errorResponse('Request timed out', 504);
    }
    console.error('[Feed Proxy] Error:', error);
    return errorResponse(error instanceof Error ? error.message : 'Failed to fetch feed', 502);
  } finally {
    clearTimeout(timer);
  }
}
