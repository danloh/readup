import { useEffect, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { addReadSeconds } from '@/services/usageService';

/**
 * Tracks continuous reading sessions and saves read time when session ends.
 * Only sessions longer than minSessionSeconds are counted (default 10s).
 * 2 ways to trigger addReadSeconds: VisibilityChangeHidden and Unload
 */
export default function useReadingTracker(
  active: boolean, 
  bookKey: string,
  minSessionSeconds = 10, 
  idleTimeoutSeconds = 60 * 5 // should be different for different screen size
) {
  const { envConfig } = useEnv();
  const now = () => Date.now();
  const sessionActive = useRef(active);
  const sessionStart = useRef<number | null>(now());
  const lastActivity = useRef<number | null>(now());
  const idleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const endSessionIfNeeded = async () => {
      // console.log('>> active ', sessionActive.current, 'start ', sessionStart.current, 'last ', lastActivity.current);
      if (!sessionActive.current || !sessionStart.current || !lastActivity.current) return;
      const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
      sessionActive.current = false;
      sessionStart.current = null;
      lastActivity.current = null;
      // console.log('>> Duration(end): ', duration);
      if (duration >= minSessionSeconds) {
        // save duration in seconds
        try {
          await addReadSeconds(envConfig, bookKey, duration);
          // console.log('Record reading time: endSession');
        } catch (err) {
          console.error('Failed to save reading time: endSession', err);
        }
      }
    };

    // idle for idleTimeoutSeconds(no Activity),will end the session.
    // During the idleTimeoutSeconds, should complete one page, 
    // at least need to click/scroll... to paginate, 
    // such activity will reset the timeout
    const resetIdleTimer = () => {
      // here to clear Timer if any active before the idleTimeout delay
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      // reset the timer
      idleTimer.current = window.setTimeout(() => {
        // for any unexpected idle
        if (lastActivity.current) {
          lastActivity.current += Math.min(minSessionSeconds, 10) * 1000;
        }
        
        endSessionIfNeeded();
      }, idleTimeoutSeconds * 1000);
    };

    const onActivity = (_ev?: string) => {
      const t = now();
      lastActivity.current = t;
      // re-active if not active(ended before) 
      if (!sessionActive.current) {
        sessionActive.current = true;
        sessionStart.current = t;
      }
      resetIdleTimer();
      // console.log(
      //   '>> Event ', _ev, 'active ', sessionActive, 'start ', sessionStart, 'last ', lastActivity
      // );
    };

    // ref: https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event
    const onVisibilityChange = () => {
      if (document.hidden) {
        // console.log('>> Hide visibility as end session');
        onActivity('hide-vis');
        // hide as end session and record reading time
        endSessionIfNeeded(); 
      } else {
        // treat show visibility as activity to restart session
        // console.log('>> Show visibility as start session');
        onActivity('show-vis');
      }
    };

    // ref: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
    const onBeforeUnload = () => {
      // synchronous end (best effort)
      if (sessionActive.current && sessionStart.current && lastActivity.current) {
        const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
        sessionActive.current = false;
        sessionStart.current = null;
        lastActivity.current = null;
        // console.log('>> Duration(unload): ', duration);
        if (duration >= minSessionSeconds) {
          // call addReadSeconds but do not await
          addReadSeconds(envConfig, bookKey, duration).then(() => {
            // console.log("Record reading seconds: onBeforeUnload");
          }).catch(() => {
            console.warn("Failed to Record reading seconds: onBeforeUnload");
          });
        }
      }
    };

    document.addEventListener('mousemove', () => onActivity('mousemove'));
    document.addEventListener('wheel', () => onActivity('wheel'));
    document.addEventListener('keydown', () => onActivity('keydown'));
    document.addEventListener('touchstart', () => onActivity('touch'));
    document.addEventListener('scroll', () => onActivity('scroll'), true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);

    // start idle timer initially
    resetIdleTimer();

    return () => {
      document.removeEventListener('mousemove', () => onActivity());
      document.removeEventListener('wheel', () => onActivity());
      document.removeEventListener('keydown', () => onActivity());
      document.removeEventListener('touchstart', () => onActivity());
      document.removeEventListener('scroll', () => onActivity(), true);
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
