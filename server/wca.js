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
  const [data, participations] = await Promise.all([
    request(`/persons/${id}`, fetcher),
    request(`/persons/${id}/competitions`, fetcher),
  ]);
  const person = data.person;
  if (!person || typeof person.name !== 'string')
    throw new Error('La WCA devolvió un perfil que no podemos leer.');
  if (!Array.isArray(participations))
    throw new Error('La WCA devolvió unas competiciones que no podemos leer.');
  // This endpoint returns all attended competitions without pagination. Keep only public metadata.
  const competitions = participations
    .filter((c) => typeof c.id === 'string' && /^[A-Za-z0-9_-]+$/.test(c.id))
    .map((c) => ({
      id: c.id,
      name: String(c.name ?? c.id),
      city: String(c.city ?? c.city_name ?? ''),
      country: String(c.country_iso2 ?? ''),
      date: String(c.start_date ?? ''),
    }));
  competitions.sort((a, b) => b.date.localeCompare(a.date));
  return {
    id,
    name: person.name,
    country: String(person.country_iso2 ?? ''),
    competitions,
    importedAt: new Date().toISOString(),
  };
}
