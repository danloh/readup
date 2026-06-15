export const handleGlobalError = (e: Error) => {
  const isChunkError = e?.message?.includes('Loading chunk');

  if (!isChunkError) {
    const now = Date.now();
    const lastReload = Number(sessionStorage.getItem('lastErrorReload') || '0');
    if (now - lastReload > 60_000) {
      sessionStorage.setItem('lastErrorReload', String(now));
      window.location.reload();
    } else {
      console.warn('Error detected, but reload suppressed (rate limit)');
    }
  }
};

export const isAuthError = (error: unknown): boolean => {
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    const errorString = error.toString().toLowerCase();
    return (
      errorMessage.includes('auth') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('token') ||
      errorMessage.includes('session') ||
      errorString.includes('401') ||
      errorString.includes('403') ||
      errorString.includes('unauthenticated')
    );
  }
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as any;
    return (
      errorObj.status === 401 ||
      errorObj.status === 403 ||
      errorObj.code === 'UNAUTHENTICATED' ||
      errorObj.message?.toLowerCase().includes('auth')
    );
  }
  return false;
};
