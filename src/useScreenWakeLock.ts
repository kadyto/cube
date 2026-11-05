import { useCallback, useEffect, useRef, useState } from 'react';

type WakeLockState = 'idle' | 'requesting' | 'active' | 'unavailable' | 'unsupported';

/** Hold the screen for the whole training view, independently of the timer phase. */
export function useScreenWakeLock() {
  const [state, setState] = useState<WakeLockState>('idle');
  const retryRef = useRef<() => void>(() => {});
  const retry = useCallback(() => retryRef.current(), []);

  useEffect(() => {
    if (!window.isSecureContext || !navigator.wakeLock?.request) {
      setState('unsupported');
      return;
    }
    const wakeLock = navigator.wakeLock;
    let sentinel: WakeLockSentinel | null = null;
    let disposed = false,
      pageActive = true,
      pending = false,
      retryOnReturn = false;
    const visible = () => !disposed && pageActive && document.visibilityState === 'visible';
    const release = () => {
      const previous = sentinel;
      sentinel = null;
      if (!disposed) setState('idle');
      if (previous) void previous.release().catch(() => {});
    };
    const request = async () => {
      if (!visible() || pending || sentinel) return;
      pending = true;
      setState('requesting');
      try {
        const next = await wakeLock.request('screen');
        // An acquisition can finish after leaving the view or hiding the page.
        if (!visible()) {
          await next.release();
          return;
        }
        if (next.released) {
          setState('unavailable');
          return;
        }
        sentinel = next;
        next.addEventListener(
          'release',
          () => {
            if (sentinel !== next) return;
            sentinel = null;
            if (!disposed) setState(visible() ? 'unavailable' : 'idle');
          },
          { once: true },
        );
        setState('active');
      } catch {
        if (!disposed) setState(visible() ? 'unavailable' : 'idle');
      } finally {
        pending = false;
        // Returning to the page may precede rejection of its old, hidden request.
        if (retryOnReturn) {
          retryOnReturn = false;
          void request();
        }
      }
    };
    const recover = () => {
      if (!visible()) return;
      if (pending) retryOnReturn = true;
      else void request();
    };
    const visibilityChanged = () => {
      if (document.visibilityState === 'visible') recover();
      else release();
    };
    const pageHidden = () => {
      pageActive = false;
      release();
    };
    const pageShown = () => {
      pageActive = true;
      recover();
    };
    const interact = () => {
      void request();
    };
    retryRef.current = interact;
    document.addEventListener('visibilitychange', visibilityChanged);
    window.addEventListener('pagehide', pageHidden);
    window.addEventListener('pageshow', pageShown);
    window.addEventListener('focus', recover);
    // Some mobile browsers require a gesture, or revoke the lock to save battery.
    window.addEventListener('pointerdown', interact, { capture: true, passive: true });
    window.addEventListener('keydown', interact, true);
    void request();
    return () => {
      disposed = true;
      retryRef.current = () => {};
      document.removeEventListener('visibilitychange', visibilityChanged);
      window.removeEventListener('pagehide', pageHidden);
      window.removeEventListener('pageshow', pageShown);
      window.removeEventListener('focus', recover);
      window.removeEventListener('pointerdown', interact, true);
      window.removeEventListener('keydown', interact, true);
      release();
    };
  }, []);

  return { state, retry };
}
