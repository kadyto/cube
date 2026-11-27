import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { EventId, Penalty } from './types';
import { useTimer } from './useTimer';

type GenerateScramble = (event: EventId, signal: AbortSignal) => Promise<string>;

/** A public training session keeps just the current attempt in memory. */
export function useDemoTraining(
  generateScramble: GenerateScramble,
  keyboardScope?: RefObject<HTMLElement | null>,
) {
  const [event, setEvent] = useState<EventId>('333');
  const [alg, setAlg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inspection, setInspection] = useState(false);
  const [result, setResult] = useState<{ timeCs: number; penalty: Penalty } | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useTimer({
    disabled: loading || !alg,
    inspection,
    onFinish: (timeCs, penalty) => setResult({ timeCs, penalty }),
    keyboardScope,
  });
  const resetTimer = timer.reset;
  const cancel = useCallback(() => {
    resetTimer();
    setResult(null);
  }, [resetTimer]);
  const generate = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError('');
    setAlg(null);
    cancel();
    try {
      const next = await generateScramble(event, controller.signal);
      if (!controller.signal.aborted) setAlg(next);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'No se pudo generar la mezcla.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [event, cancel, generateScramble]);

  useEffect(() => {
    void generate();
    return () => request.current?.abort();
  }, [generate]);

  function chooseEvent(next: EventId) {
    if (timer.active || next === event) return;
    request.current?.abort();
    cancel();
    setAlg(null);
    setError('');
    setLoading(true);
    setEvent(next);
  }

  return {
    event,
    chooseEvent,
    alg,
    loading,
    error,
    inspection,
    setInspection,
    result,
    generate,
    timer: { ...timer, reset: cancel },
  };
}
