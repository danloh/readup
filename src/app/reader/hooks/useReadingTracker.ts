import { useEffect, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { addReadSeconds } from '@/services/usageService';

/**
 * Tracks continuous reading sessions and saves read time when session ends.
 * Only sessions longer than minSessionSeconds are counted (default 60s).
 */
export default function useReadingTracker(
  active: boolean, 
  minSessionSeconds = 60, 
  idleTimeoutSeconds = 30
) {
  const { envConfig } = useEnv();
  const sessionActive = useRef(false);
  const sessionStart = useRef<number | null>(null);
  const lastActivity = useRef<number | null>(null);
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const now = () => Date.now();

    const endSessionIfNeeded = async () => {
      if (!sessionActive.current || !sessionStart.current || !lastActivity.current) return;
      const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
      sessionActive.current = false;
      sessionStart.current = null;
      lastActivity.current = null;
      if (duration >= minSessionSeconds) {
        // save duration in seconds
        try {
          await addReadSeconds(envConfig, duration);
        } catch (err) {
          console.error('Failed to save reading time', err);
        }
      }
    };

    const resetIdleTimer = () => {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => {
        endSessionIfNeeded();
      }, idleTimeoutSeconds * 1000);
    };

    const onActivity = () => {
      const t = now();
      lastActivity.current = t;
      if (!sessionActive.current) {
        sessionActive.current = true;
        sessionStart.current = t;
      }
      resetIdleTimer();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        endSessionIfNeeded();
      } else {
        // treat visibility as activity
        onActivity();
      }
    };

    const onBeforeUnload = () => {
      // synchronous end (best effort)
      if (sessionActive.current && sessionStart.current && lastActivity.current) {
        const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
        sessionActive.current = false;
        sessionStart.current = null;
        lastActivity.current = null;
        if (duration >= minSessionSeconds) {
          // call addReadSeconds but do not await
          addReadSeconds(envConfig, duration).catch(() => {});
        }
      }
    };

    document.addEventListener('mousemove', onActivity);
    document.addEventListener('wheel', onActivity);
    document.addEventListener('keydown', onActivity);
    document.addEventListener('touchstart', onActivity);
    document.addEventListener('scroll', onActivity, true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    // start idle timer if there's initial activity
    resetIdleTimer();

    return () => {
      document.removeEventListener('mousemove', onActivity);
      document.removeEventListener('wheel', onActivity);
      document.removeEventListener('keydown', onActivity);
      document.removeEventListener('touchstart', onActivity);
      document.removeEventListener('scroll', onActivity, true);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (idleTimer.current) {
        window.clearTimeout(idleTimer.current);
        idleTimer.current = null;
      }
      // finalize session
      endSessionIfNeeded();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, minSessionSeconds, idleTimeoutSeconds]);
}
