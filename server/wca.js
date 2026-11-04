import { WCA_EVENT_IDS, competitionResults } from '../shared/wca.js';

const BASE = 'https://www.worldcubeassociation.org';
const wcaIdPattern = /^\d{4}[A-Z]{4}\d{2}$/;

export function normalizeWcaId(input) {
  const id = String(input ?? '')
    .trim()
    .toUpperCase();
  if (!wcaIdPattern.test(id)) throw new Error('El ID WCA debe tener un formato como 2015BORR01.');
  return id;
}

async function request(path, fetcher) {
  let response;
  try {
    response = await fetcher(`${BASE}/api/v0${path}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
    });
  } catch {
    throw new Error(
      'No pudimos conectar con la WCA. Tu ID sigue guardado; vuelve a intentarlo más tarde.',
    );
  }
  if (response.status === 404)
    throw new Error('No encontramos ese perfil en la WCA. Revisa el ID.');
  if (!response.ok)
    throw new Error('La WCA no está disponible ahora. Puedes guardar tu ID y volver a intentarlo.');
  try {
    return await response.json();
  } catch {
    throw new Error(
      'La WCA devolvió una respuesta que no podemos leer. Vuelve a intentarlo más tarde.',
    );
  }
}

export async function importWca(input, fetcher = fetch) {
  const id = normalizeWcaId(input);
  const [data, participations, results] = await Promise.all([
    request(`/persons/${id}`, fetcher),
    request(`/persons/${id}/competitions`, fetcher),
    request(`/persons/${id}/results`, fetcher),
  ]);
  const person = data.person;
  if (!person || typeof person.name !== 'string')
    throw new Error('La WCA devolvió un perfil que no podemos leer.');
  if (!Array.isArray(participations))
    throw new Error('La WCA devolvió unas competiciones que no podemos leer.');
  if (!Array.isArray(results))
    throw new Error('La WCA devolvió unos resultados de competición que no podemos leer.');
  const byCompetition = competitionResults(results);
  if (
    !data.personal_records ||
    typeof data.personal_records !== 'object' ||
    Array.isArray(data.personal_records)
  )
    throw new Error('La WCA devolvió unas marcas que no podemos leer.');
  const validBest = (record) =>
    Number.isInteger(record?.best) && record.best > 0 ? record.best : null;
  const personalRecords = WCA_EVENT_IDS.map((event) => ({
    event,
    single: validBest(data.personal_records[event]?.single),
    average: validBest(data.personal_records[event]?.average),
  })).filter((record) => record.single !== null || record.average !== null);
  // This endpoint returns all attended competitions without pagination. Keep only public metadata.
  const competitions = participations
    .filter((c) => typeof c.id === 'string' && /^[A-Za-z0-9_-]+$/.test(c.id))
    .map((c) => ({
      id: c.id,
      name: String(c.name ?? c.id),
      city: String(c.city ?? c.city_name ?? ''),
      country: String(c.country_iso2 ?? ''),
      date: String(c.start_date ?? ''),
      results: byCompetition.get(c.id) ?? [],
    }));
  competitions.sort((a, b) => b.date.localeCompare(a.date));
  return {
    id,
    name: person.name,
    country: String(person.country_iso2 ?? ''),
    personalRecords,
    competitions,
    importedAt: new Date().toISOString(),
  };
}
