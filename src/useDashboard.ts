import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_INTERVAL, readSnapshot } from './core';
import type { Snapshot } from './core';

export function useDashboard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [automatic, setAutomatic] = useState(true);
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);
  const active = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    try {
      const next = await readSnapshot(controller.signal);
      if (!controller.signal.aborted) {
        setSnapshot(next);
        setError(null);
        setNow(Date.now());
      }
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to read Sepolia. Refresh to try again.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (active.current === controller) { inFlight.current = false; active.current = null; }
    }
  }, []);

  useEffect(() => {
    void refresh();
    return () => { active.current?.abort(); inFlight.current = false; };
  }, [refresh]);

  useEffect(() => {
    if (!automatic) return;
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, POLL_INTERVAL);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [automatic, refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return { snapshot, loading, error, automatic, setAutomatic, refresh, now };
}
