const USER_AGENT = "scout-vc-analyst/0.1 (+prototype de recherche)";

export class SourceError extends Error {}

async function request(url: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { "user-agent": USER_AGENT, accept: "application/json", ...init.headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new SourceError(`${new URL(url).host} a répondu ${response.status}`);
  return response;
}

export async function getJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return (await request(url, init)).json() as Promise<T>;
}

export async function getText(url: string, init?: RequestInit, timeoutMs?: number): Promise<string> {
  return (await request(url, init, timeoutMs)).text();
}

/** Comme getJson, mais renvoie null sur 404 (ex. un ATS que la boîte n'utilise pas). */
export async function getJsonOrNull<T = unknown>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    return await getJson<T>(url, init);
  } catch (error) {
    if (error instanceof SourceError && / 40[04]$/.test(error.message)) return null;
    throw error;
  }
}
