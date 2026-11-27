import { useCallback, useEffect, useRef, useState } from 'react';
import type { Penalty } from './types';

type Phase = 'idle' | 'holding' | 'ready' | 'inspection' | 'running' | 'stopped';
export function useTimer({
  disabled,
  inspection,
  onFinish,
}: {
  disabled: boolean;
  inspection: boolean;
  onFinish: (cs: number, penalty: Penalty) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle'),
    [elapsed, setElapsed] = useState(0),
    [inspectionElapsed, setInspectionElapsed] = useState(0);
  const phaseRef = useRef<Phase>('idle'),
    startRef = useRef(0),
    inspectionRef = useRef<number | null>(null),
    spaceHeld = useRef(false),
    holdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const penaltyRef = useRef<Penalty>('none'),
    finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const reset = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = null;
    inspectionRef.current = null;
    penaltyRef.current = 'none';
    setElapsed(0);
    setInspectionElapsed(0);
    changePhase('idle');
  }, [changePhase]);
  const press = useCallback(() => {
    const current = phaseRef.current;
    if (current === 'running') {
      const cs = Math.max(1, Math.floor((performance.now() - startRef.current) / 10));
      setElapsed(cs);
      changePhase('stopped');
      finishRef.current(cs, penaltyRef.current);
      return true;
    }
    if (disabled || (current !== 'idle' && current !== 'inspection')) return false;
    if (inspectionRef.current !== null) {
      const seconds = (performance.now() - inspectionRef.current) / 1000;
      penaltyRef.current = seconds >= 17 ? 'DNF' : seconds >= 15 ? '+2' : 'none';
      setInspectionElapsed(seconds);
    }
    changePhase('holding');
    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      changePhase('ready');
    }, 350);
    return true;
  }, [disabled, changePhase]);
  const release = useCallback(() => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    if (phaseRef.current === 'ready') {
      const now = performance.now();
      if (inspection && inspectionRef.current === null) {
        inspectionRef.current = now;
        setInspectionElapsed(0);
        changePhase('inspection');
      } else {
        inspectionRef.current = null;
        startRef.current = now;
        setElapsed(0);
        changePhase('running');
      }
    } else if (phaseRef.current === 'holding')
      changePhase(inspectionRef.current !== null ? 'inspection' : 'idle');
  }, [inspection, changePhase]);
  const cancelPress = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = null;
    if (['holding', 'ready'].includes(phaseRef.current))
      changePhase(inspectionRef.current !== null ? 'inspection' : 'idle');
  }, [changePhase]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (phaseRef.current === 'running')
        setElapsed(Math.floor((performance.now() - startRef.current) / 10));
      else if (phaseRef.current === 'inspection' && inspectionRef.current !== null)
        setInspectionElapsed((performance.now() - inspectionRef.current) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === 'Escape') {
        if (['running', 'inspection', 'holding', 'ready'].includes(phaseRef.current)) reset();
        return;
      }
      if (event.code !== 'Space') return;
      if (spaceHeld.current) {
        event.preventDefault();
        return;
      }
      if (event.repeat || document.querySelector('dialog[open]')) return;
      const target = event.target;
      if (target instanceof Element && target.closest('input,textarea,select,a,summary')) return;
      if (press()) {
        event.preventDefault();
        spaceHeld.current = true;
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space' && spaceHeld.current) {
        event.preventDefault();
        spaceHeld.current = false;
        release();
      }
    };
    const blur = () => {
      spaceHeld.current = false;
      cancelPress();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [press, release, reset, cancelPress]);
  useEffect(
    () => () => {
      if (holdRef.current) clearTimeout(holdRef.current);
    },
    [],
  );
  return {
    phase,
    elapsed,
    inspectionElapsed,
    inspecting: phase !== 'running' && inspectionRef.current !== null,
    press,
    release,
    cancelPress,
    reset,
    active: ['running', 'holding', 'ready', 'inspection'].includes(phase),
  };
}
