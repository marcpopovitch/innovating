// Source live Légifrance via l'API PISTE (DILA) — OAuth2 client_credentials.
// Nécessite PISTE_CLIENT_ID / PISTE_CLIENT_SECRET (inscription gratuite sur
// https://piste.gouv.fr). Sans identifiants, pisteConfigured() renvoie false et
// l'appelant retombe sur le dump DILA hors-ligne (le corpus reste exploitable).
const TOKEN_URL = "https://oauth.piste.gouv.fr/api/oauth/token";
const API_BASE = "https://api.piste.gouv.fr/dila/legifrance/lf-engine-app";

export function pisteConfigured(): boolean {
  return Boolean(process.env.PISTE_CLIENT_ID && process.env.PISTE_CLIENT_SECRET);
}

async function getToken(): Promise<string> {
  const clientId = process.env.PISTE_CLIENT_ID;
  const clientSecret = process.env.PISTE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("PISTE non configuré : définir PISTE_CLIENT_ID et PISTE_CLIENT_SECRET dans .env.local");
  }
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "openid",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`PISTE token ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("PISTE token : réponse sans access_token");
  return json.access_token;
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`PISTE ${path} ${res.status}`);
  return (await res.json()) as T;
}

/** Un texte du sommaire du Journal officiel renvoyé par PISTE. */
export interface PisteJorfItem {
  id: string; // JORFTEXT…
  title: string;
  nature: string | null;
  date_publi: string | null;
}

/**
 * Sommaire du Journal officiel pour une date (YYYY-MM-DD, défaut : aujourd'hui).
 * Renvoie la réponse PISTE aplatie en PisteJorfItem[] ; tolère les variations de
 * forme de l'API (structure JORF imbriquée) en retenant tout nœud à id JORFTEXT.
 */
export async function jorfSommaire(date?: string): Promise<PisteJorfItem[]> {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const raw = await postJson<Record<string, unknown>>("/consult/jorfCont", { date: day, pageNumber: 1, pageSize: 50 });
  const items: PisteJorfItem[] = [];
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    const o = node as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : typeof o.cid === "string" ? o.cid : null;
    if (id && id.startsWith("JORFTEXT")) {
      items.push({
        id,
        title: String(o.title ?? o.titre ?? o.pathTitle ?? "").trim(),
        nature: typeof o.nature === "string" ? o.nature : null,
        date_publi: typeof o.datePubli === "string" ? o.datePubli : day,
      });
    }
    Object.values(o).forEach(visit);
  };
  visit(raw);
  // Déduplique par id (un même texte peut apparaître dans plusieurs rubriques).
  return [...new Map(items.map((i) => [i.id, i])).values()];
}
