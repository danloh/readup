'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';
import { useTranslation } from '@/hooks/useTranslation';
import { handleOAuthCallback } from '@/services/bsky/oauth';
import { getOAuthClientId } from '@/services/bsky/oauth-config';

/**
 * OAuth callback page
 * The @atproto/oauth-client-browser library automatically processes the OAuth flow
 * when the page loads with authorization code in the URL.
 */
export default function OAuthCallbackPage() {
  const _ = useTranslation();
  const router = useRouter();
  const { completeOAuthLogin } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const clientId = getOAuthClientId();
        if (!clientId) {
          throw new Error('OAuth client ID not configured');
        }

        // The library automatically processes the authorization response
        const session = await handleOAuthCallback();

        if (!session) {
          throw new Error('No session created from OAuth callback');
        }

        // Get the host from sessionStorage
        const host = sessionStorage.getItem('oauth_host') || 'bsky.social';
        sessionStorage.removeItem('oauth_host');

        // Complete the login process
        const success = await completeOAuthLogin(session, host);

        if (!success) {
          throw new Error('Failed to complete OAuth login');
        }

        // Show success message
        eventDispatcher.dispatch('toast', {
          message: _('Successfully signed in with OAuth'),
          timeout: 2000,
          type: 'success',
        });

        // Redirect to home page
        setTimeout(() => {
          router.push('/');
        }, 500);
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('OAuth callback error:', err);
        setError(errorMsg);
        setIsProcessing(false);

        eventDispatcher.dispatch('toast', {
          message: `OAuth Error: ${errorMsg}`,
          timeout: 3000,
          type: 'error',
        });
      }
    };

    processCallback();
  }, [completeOAuthLogin, router, _]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="card mx-auto p-6 w-full max-w-md">
          <h1 className="text-2xl font-bold text-error mb-4">
            {_('Authentication Error')}
          </h1>
          <p className="text-error mb-4">{error}</p>
          <button
            onClick={() => router.push('/auth')}
            className="btn btn-primary w-full"
          >
            {_('Try Again')}
          </button>
        </div>
      </div>
    );
  }

  if (isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="card mx-auto p-6 w-full max-w-md text-center">
          <div className="loading loading-spinner loading-lg mx-auto mb-4"></div>
          <h1 className="text-xl font-bold mb-2">
            {_('Completing Sign In')}
          </h1>
          <p className="text-sm text-gray-600">
            {_('Please wait while we verify your authorization...')}
          </p>
        </div>
      </div>
    );
  }

  return null;
}
