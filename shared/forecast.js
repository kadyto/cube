import { WCA_EVENT_IDS } from './wca.js';

const validBest = (value) => Number.isSafeInteger(value) && value > 0;
function personalBest(person, event, basis) {
  const values = (Array.isArray(person.personalBests) ? person.personalBests : [])
    .filter((pb) => pb.eventId === event && pb.type === basis)
    .map((pb) => pb.best ?? pb.value)
    .filter(validBest);
  return values.length ? Math.min(...values) : null;
}

/** Compare only the public PB snapshot of accepted competitors. No competitor names are retained. */
export function estimateCompetition(wcif, wcaId) {
  if (
    !wcif ||
    !String(wcif.formatVersion ?? '').startsWith('1.') ||
    !Array.isArray(wcif.persons) ||
    !Array.isArray(wcif.events)
  )
    throw new Error('El formato de la lista pública no permite hacer una comparación fiable.');
  const unique = new Map();
  wcif.persons.forEach((person, i) => {
    if (
      person?.registration?.status !== 'accepted' ||
      person.registration.isCompeting !== true ||
      !Array.isArray(person.registration.eventIds)
    )
      return;
    const key =
      person.wcaId ||
      (person.registrantId != null
        ? `r:${person.registrantId}`
        : person.wcaUserId != null
          ? `u:${person.wcaUserId}`
          : `row:${i}`);
    if (!unique.has(key)) unique.set(key, person);
  });
  const competitors = [...unique.values()];
  const own = competitors.find((person) => person.wcaId === wcaId);
  if (!own)
    return {
      eventIds: [],
      estimates: [],
      notice: 'La lista pública todavía no incluye tu inscripción aceptada.',
    };
  const eventIds = WCA_EVENT_IDS.filter((event) => own.registration.eventIds.includes(event));
  const estimates = eventIds.map((event) => {
    const definition = wcif.events.find((item) => item.id === event);
    const firstRound =
      definition?.rounds?.find((round) => round.id === `${event}-r1`) ?? definition?.rounds?.[0];
    const format = firstRound?.format;
    const basis = ['a', 'm'].includes(format)
      ? 'average'
      : ['1', '2', '3'].includes(format)
        ? 'single'
        : null;
    const participants = competitors.filter((person) =>
      person.registration.eventIds.includes(event),
    );
    if (!basis)
      return {
        event,
        basis: null,
        ownBest: null,
        total: participants.length,
        comparable: 0,
        missing: participants.length,
        positionMin: null,
        positionMax: null,
        tied: 0,
        reason: 'Formato de ronda no compatible con esta comparación.',
      };
    const ownBest = personalBest(own, event, basis);
    const values = participants.map((person) => personalBest(person, event, basis));
    const known = values.filter((value) => value !== null);
    const missing = values.length - known.length;
    const positionMin =
      ownBest === null ? null : 1 + known.filter((value) => value < ownBest).length;
    return {
      event,
      basis,
      ownBest,
      total: participants.length,
      comparable: known.length,
      missing,
      positionMin,
      positionMax: positionMin === null ? null : positionMin + missing,
      tied: ownBest === null ? 0 : known.filter((value) => value === ownBest).length - 1,
      reason:
        ownBest === null
          ? `Todavía no tienes una ${basis === 'average' ? 'media' : 'marca individual'} oficial comparable.`
          : null,
    };
  });
  return { eventIds, estimates, notice: null };
}

export function futureCompetitions(competitions, now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10);
  return competitions
    .filter((competition) => competition.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
