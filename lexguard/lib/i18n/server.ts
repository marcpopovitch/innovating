import { cookies } from "next/headers";
import { DEFAULT_LANG, isLang, LANG_COOKIE, type Lang } from "./config";
import { makeT } from "./translate";

// Langue choisie (cookie), sinon anglais : le site s'ouvre en anglais quelle que soit la langue du navigateur.
export async function getLang(): Promise<Lang> {
  const saved = (await cookies()).get(LANG_COOKIE)?.value;
  if (isLang(saved)) return saved;
  return DEFAULT_LANG;
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: makeT(lang) };
}
