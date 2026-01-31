import { useEffect, useRef } from 'react';
import { useEnv } from '@/context/EnvContext';
import { addReadSeconds } from '@/services/usageService';


// TODO: MORE fine-grain record reading time per book
/**
 * Tracks continuous reading sessions and saves read time when session ends.
 * Only sessions longer than minSessionSeconds are counted (default 10s).
 */
export default function useReadingTracker(
  active: boolean, 
  minSessionSeconds = 10, 
  idleTimeoutSeconds = 30
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
      console.log('>> active ', sessionActive.current, 'start ', sessionStart.current, 'last ', lastActivity.current);
      if (!sessionActive.current || !sessionStart.current || !lastActivity.current) return;
      const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
      sessionActive.current = false;
      sessionStart.current = null;
      lastActivity.current = null;
      console.log('>> Duration(end): ', duration);
      if (duration >= minSessionSeconds) {
        // save duration in seconds
        try {
          await addReadSeconds(envConfig, duration);
          console.log('Record reading time: endSession');
        } catch (err) {
          console.error('Failed to save reading time: endSession', err);
        }
      }
    };

    // const resetIdleTimer = () => {
    //   console.log('>> To rest Idle Timer');
    //   if (idleTimer.current) {
    //     console.log('>> clear Idle Timer');
    //     window.clearTimeout(idleTimer.current);
    //   }
    //   console.log('>> rest Idle Timer-endSession');
    //   idleTimer.current = window.setTimeout(() => {
    //     endSessionIfNeeded();
    //   }, idleTimeoutSeconds * 1000);
    // };

    const onActivity = (ev?: string) => {
      const t = now();
      lastActivity.current = t;
      // re-active if not active 
      if (!sessionActive.current) {
        sessionActive.current = true;
        sessionStart.current = t;
      }
      // resetIdleTimer();
      console.log(
        '>> Event ', ev, 'active ', sessionActive, 'start ', sessionStart, 'last ', lastActivity
      );
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        console.log('>> Hide visibility as end session');
        onActivity('hide-vis');
        // hide as end session and record reading time
        endSessionIfNeeded(); 
      } else {
        // treat show visibility as activity to restart session
        console.log('>> Show visibility as start session');
        onActivity('show-vis');
      }
    };

    const onBeforeUnload = () => {
      // synchronous end (best effort)
      if (sessionActive.current && sessionStart.current && lastActivity.current) {
        const duration = Math.floor((lastActivity.current - sessionStart.current) / 1000);
        sessionActive.current = false;
        sessionStart.current = null;
        lastActivity.current = null;
        console.log('>> Duration(unload): ', duration);
        if (duration >= minSessionSeconds) {
          // call addReadSeconds but do not await
          addReadSeconds(envConfig, duration).then(() => {
            console.warn("Record reading seconds: onBeforeUnload");
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

    // start idle timer if there's initial activity
    // resetIdleTimer();

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
