export async function api<T = unknown>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json', 'X-Cube-Request': '1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !['/login', '/password'].includes(path))
      window.dispatchEvent(new Event('cube-auth-expired'));
    throw new Error(
      data.error ?? 'No se pudo conectar. Comprueba tu conexión e inténtalo de nuevo.',
    );
  }
  return data as T;
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Algo no ha ido bien. Inténtalo de nuevo.';
