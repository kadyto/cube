import { EVENT_IDS } from '../shared/domain.js';

export function readTrainingEvent() {
  try {
    const saved = localStorage.getItem('cube-event');
    return EVENT_IDS.find((id) => id === saved) ?? '333';
  } catch {
    return '333';
  }
}
