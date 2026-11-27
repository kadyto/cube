import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Penalty } from './types';

type Phase = 'idle' | 'holding' | 'ready' | 'inspection' | 'running' | 'stopped';
export function useTimer({
  disabled,
  inspection,
  onFinish,
  keyboardScope,
}: {
  disabled: boolean;
  inspection: boolean;
  onFinish: (cs: number, penalty: Penalty) => void;
  keyboardScope?: RefObject<HTMLElement | null>;
}) {
  const [phase, setPhase] = useState<Phase>('idle'),
    [elapsed, setElapsed] = useState(0),
    [inspectionElapsed, setInspectionElapsed] = useState(0);
  const phaseRef = useRef<Phase>('idle'),
    startRef = useRef(0),
    inspectionRef = useRef(0),
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
    inspectionRef.current = 0;
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
      return;
    }
    if (disabled || !['idle', 'inspection'].includes(current)) return;
    changePhase('holding');
    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      changePhase('ready');
    }, 350);
  }, [disabled, changePhase]);
  const release = useCallback(() => {
    if (holdRef.current) {
      clearTimeout(holdRef.current);
      holdRef.current = null;
    }
    if (phaseRef.current === 'ready') {
      if (inspection && !inspectionRef.current) {
        inspectionRef.current = performance.now();
        setInspectionElapsed(0);
        changePhase('inspection');
      } else {
        const seconds = inspectionRef.current
          ? (performance.now() - inspectionRef.current) / 1000
          : 0;
        penaltyRef.current = seconds >= 17 ? 'DNF' : seconds >= 15 ? '+2' : 'none';
        inspectionRef.current = 0;
        startRef.current = performance.now();
        setElapsed(0);
        changePhase('running');
      }
    } else if (phaseRef.current === 'holding')
      changePhase(inspectionRef.current ? 'inspection' : 'idle');
  }, [inspection, changePhase]);
  const cancelPress = useCallback(() => {
    if (holdRef.current) clearTimeout(holdRef.current);
    holdRef.current = null;
    if (['holding', 'ready'].includes(phaseRef.current))
      changePhase(inspectionRef.current ? 'inspection' : 'idle');
  }, [changePhase]);
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      if (phaseRef.current === 'running')
        setElapsed(Math.floor((performance.now() - startRef.current) / 10));
      else if (inspectionRef.current)
        setInspectionElapsed((performance.now() - inspectionRef.current) / 1000);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    let spaceHeld = false;
    const down = (event: KeyboardEvent) => {
      if (
        keyboardScope &&
        (!(event.target instanceof Node) || !keyboardScope.current?.contains(event.target))
      )
        return;
      if (event.code === 'Escape') {
        if (['running', 'inspection', 'holding', 'ready'].includes(phaseRef.current)) reset();
        return;
      }
      if (event.code !== 'Space' || event.repeat || document.querySelector('dialog[open]')) return;
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,a,summary,button:not([data-timer])')) return;
      event.preventDefault();
      spaceHeld = true;
      press();
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === 'Space' && spaceHeld) {
        event.preventDefault();
        spaceHeld = false;
        release();
      }
    };
    const blur = () => {
      spaceHeld = false;
      cancelPress();
    };
    const scope = keyboardScope?.current;
    const focusOut = (event: FocusEvent) => {
      if (
        spaceHeld &&
        (!(event.relatedTarget instanceof Node) || !scope?.contains(event.relatedTarget))
      )
        blur();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    scope?.addEventListener('focusout', focusOut);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      scope?.removeEventListener('focusout', focusOut);
    };
  }, [press, release, reset, cancelPress, keyboardScope]);
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
    inspecting: phase !== 'running' && inspectionRef.current > 0,
    press,
    release,
    cancelPress,
    reset,
    active: ['running', 'holding', 'ready', 'inspection'].includes(phase),
  };
}
