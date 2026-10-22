"use client";

import { createContext, useContext, useMemo } from "react";
import type { Lang } from "@/lib/i18n/config";
import { makeT, type T } from "@/lib/i18n/translate";

const Ctx = createContext<{ lang: Lang; t: T }>({ lang: "en", t: makeT("en") });

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: makeT(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// Dans les composants client : const { t, lang } = useI18n();
export const useI18n = () => useContext(Ctx);
