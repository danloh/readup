'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { eventDispatcher } from '@/utils/event';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * OAuth callback page that handles the redirect from Bluesky
 * Exchanges the authorization code for tokens
 */
export default function OAuthCallbackPage() {
  const _ = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithOAuth } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get authorization code from URL
        if (!searchParams) {
          throw new Error('Failed to get URL parameters');
        }
        
        const code = searchParams.get('code');
        const authError = searchParams.get('error');

        if (authError) {
          const errorDescription = searchParams.get('error_description');
          throw new Error(
            `OAuth authorization failed: ${authError}${errorDescription ? ` - ${errorDescription}` : ''}`
          );
        }

        if (!code) {
          throw new Error('No authorization code received from Bluesky');
        }

        // Get OAuth state from sessionStorage
        const stateJson = sessionStorage.getItem('oauth_state');
        if (!stateJson) {
          throw new Error('OAuth state not found. Please try logging in again.');
        }

        const state = JSON.parse(stateJson);
        const { verifier, host } = state;

        if (!verifier || !host) {
          throw new Error('Invalid OAuth state. Please try logging in again.');
        }

        // Clear OAuth state from sessionStorage
        sessionStorage.removeItem('oauth_state');

        // Get OAuth client ID from environment
        const clientId = process.env['NEXT_PUBLIC_OAUTH_CLIENT_ID'];
        if (!clientId) {
          throw new Error('OAuth client ID not configured');
        }

        // Exchange code for tokens
        const success = await loginWithOAuth(code, verifier, host, clientId);

        if (!success) {
          throw new Error('Failed to complete OAuth login');
        }

        // Show success message and redirect
        eventDispatcher.dispatch('toast', {
          message: _('Successfully signed in with OAuth'),
          timeout: 2000,
          type: 'success',
        });

        // Redirect to home page after a short delay
        setTimeout(() => {
          router.push('/');
        }, 500);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
        console.error('OAuth callback error:', err);
        setError(errorMsg);
        setIsProcessing(false);

        // Show error message
        eventDispatcher.dispatch('toast', {
          message: `OAuth Error: ${errorMsg}`,
          timeout: 3000,
          type: 'error',
        });
      }
    };

    processCallback();
  }, [searchParams, loginWithOAuth, router, _]);

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen'>
        <div className="card mx-auto p-6 w-full mx-auto max-w-md">
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
      <div className='flex flex-col items-center justify-center min-h-screen'>
        <div className="card mx-auto p-6 w-full mx-auto max-w-md text-center">
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
