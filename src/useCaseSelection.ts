import { useMemo, useState } from 'react';
import {
  caseGroups,
  caseGroupsByEvent,
  getCasePreparation,
  getPracticeCase,
} from '../shared/case-practice.js';
import type { EventId } from './types';

export function useCaseSelection(event: EventId, byCase: boolean, initialId?: string) {
  const [caseIds, setCaseIds] = useState<Partial<Record<EventId, string>>>(() =>
    initialId ? { [event]: initialId } : {},
  );
  const [showingAlgorithm, setShowingAlgorithm] = useState(false);
  const entry = byCase
    ? getPracticeCase(caseIds[event] ?? caseGroups[caseGroupsByEvent[event][0]][0].id)
    : null;
  const preparation = useMemo(() => (entry ? getCasePreparation(entry) : null), [entry]);

  function selectCase(id: string) {
    const next = getPracticeCase(id);
    if (!byCase || next?.event !== event || next === entry) return false;
    setCaseIds((previous) => ({ ...previous, [event]: id }));
    return true;
  }

  return {
    casePractice: entry && preparation ? { entry, preparation, showingAlgorithm } : null,
    selectCase,
    setShowingAlgorithm,
  };
}
