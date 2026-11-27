import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { caseGroups, getCasePreparation, getPracticeCase } from '../shared/case-practice.js';
import type { EventId, Penalty } from './types';
import { useTimer } from './useTimer';

type GenerateScramble = (event: EventId, signal: AbortSignal) => Promise<string>;

/** A public training session keeps just the current attempt in memory. */
export function useDemoTraining(
  generateScramble: GenerateScramble,
  keyboardScope?: RefObject<HTMLElement | null>,
) {
  const [event, setEvent] = useState<EventId>('333');
  const [selection, setSelection] = useState(() => {
    const entry = getPracticeCase(new URLSearchParams(window.location.search).get('caso'));
    return { byCase: entry !== null, entry: entry ?? caseGroups.f2l[0] };
  });
  const [showingAlgorithm, setShowingAlgorithm] = useState(false);
  const [scramble, setScramble] = useState<string | null>(null);
  const [generating, setGenerating] = useState(true);
  const [error, setError] = useState('');
  const [inspection, setInspection] = useState(false);
  const [result, setResult] = useState<{ timeCs: number; penalty: Penalty } | null>(null);
  const request = useRef<AbortController | null>(null);
  const entry = event === '333' && selection.byCase ? selection.entry : null;
  const preparation = useMemo(() => (entry ? getCasePreparation(entry) : null), [entry]);
  const byCase = entry !== null;
  const alg = preparation ?? scramble;
  const loading = !byCase && generating;
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
    setShowingAlgorithm(false);
  }, [resetTimer]);
  const generate = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setGenerating(true);
    setError('');
    setScramble(null);
    cancel();
    try {
      const next = await generateScramble(event, controller.signal);
      if (!controller.signal.aborted) setScramble(next);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(cause instanceof Error ? cause.message : 'No se pudo generar la mezcla.');
    } finally {
      if (!controller.signal.aborted) setGenerating(false);
    }
  }, [event, cancel, generateScramble]);

  useEffect(() => {
    if (byCase) return;
    void generate();
    return () => request.current?.abort();
  }, [byCase, generate]);

  const restart = useCallback(() => {
    if (byCase) cancel();
    else void generate();
  }, [byCase, cancel, generate]);

  function changeSetup() {
    request.current?.abort();
    cancel();
    setScramble(null);
    setError('');
    setGenerating(true);
  }

  function chooseEvent(next: EventId) {
    if (timer.active || next === event) return;
    changeSetup();
    setEvent(next);
  }

  function chooseMode(nextByCase: boolean) {
    if (timer.active || event !== '333' || byCase === nextByCase) return;
    changeSetup();
    setSelection({ ...selection, byCase: nextByCase });
  }

  function chooseCase(id: string) {
    const next = getPracticeCase(id);
    if (timer.active || !byCase || !next || next === entry) return;
    cancel();
    setSelection({ byCase: true, entry: next });
  }

  return {
    event,
    chooseEvent,
    casePractice: entry && preparation ? { entry, preparation, showingAlgorithm } : null,
    chooseMode,
    chooseCase,
    setShowingAlgorithm,
    alg,
    loading,
    error,
    inspection,
    setInspection,
    result,
    restart,
    timer: { ...timer, reset: cancel },
  };
}
