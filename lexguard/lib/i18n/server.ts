import { cookies, headers } from "next/headers";
import { DEFAULT_LANG, fromAcceptLanguage, isLang, LANG_COOKIE, type Lang } from "./config";
import { makeT } from "./translate";

// Langue choisie (cookie), sinon langue du navigateur, sinon français.
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  return fromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LANG;
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
