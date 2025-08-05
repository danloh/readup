import { jwtDecode } from 'jwt-decode';
import { DEFAULT_DAILY_TRANSLATION_QUOTA } from '@/services/constants';
import { isWebAppPlatform } from '@/services/environment';

interface Token {
  plan:'free';
  storage_usage_bytes: number;
  [key: string]: string | number;
}

export const getDailyTranslationPlanData = (token: string) => {
  const data = jwtDecode<Token>(token) || {};
  const plan = data['plan'] || 'free';
  const fixedQuota = parseInt(process.env['NEXT_PUBLIC_TRANSLATION_FIXED_QUOTA'] || '0');
  const quota = fixedQuota || DEFAULT_DAILY_TRANSLATION_QUOTA;

  return {
    plan,
    quota,
  };
};

export const getAccessToken = async (): Promise<string | null> => {
  // In browser context there might be two instances of supabase one in the app route
  // and the other in the pages route, and they might have different sessions
  // making the access token invalid for API calls. In that case we should use localStorage.
  if (isWebAppPlatform()) {
    return localStorage.getItem('token') ?? null;
  }

  return null;
};

export const getUserID = async (): Promise<string | null> => {
  if (isWebAppPlatform()) {
    const user = localStorage.getItem('user') ?? '{}';
    return JSON.parse(user).id ?? null;
  }
  
  return null;
};

export const validateUserAndToken = async (authHeader: string | null | undefined) => {
  if (!authHeader) return {};

  return {};
};
