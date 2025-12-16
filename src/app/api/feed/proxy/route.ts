import { NextRequest, NextResponse } from 'next/server';
import { FeedResponse, webFetchFeed } from '@/app/feed/components/dataAgent';

function createResponse<T>(
  success: boolean,
  data: T | null = null,
  error: string | null = null,
  responseTime: number,
): FeedResponse<T> {
  return {
    success,
    data: data || undefined,
    error: error || undefined,
    timestamp: new Date().toISOString(),
    responseTime,
  };
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json(
      { error: 'Missing URL parameter. Usage: /api/feed/proxy?url=YOUR_FEED_URL' },
      { status: 400 },
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
  }

  const startTime = Date.now();

  try {
    const result = await webFetchFeed(url);
    const responseTime = Date.now() - startTime;

    if (!result) {
      return NextResponse.json(createResponse(false, null, 'Feed not found', responseTime), {
        status: 404,
      });
    }

    return NextResponse.json(createResponse(true, result, null, responseTime), {
      status: 200,
    });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('Fetch Feed error:', error);

    let errorMessage = 'Internal server error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('rate limit')) {
        statusCode = 429;
      } else if (error.message.includes('forbidden') || error.message.includes('API key')) {
        statusCode = 403;
      } else if (error.message.includes('Invalid ISBN')) {
        statusCode = 400;
      }
    }

    return NextResponse.json(createResponse(false, null, errorMessage, responseTime), {
      status: statusCode,
    });
  }
}
