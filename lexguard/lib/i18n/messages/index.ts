// Un fichier par zone du site ; chaque fichier exporte { fr, en } avec exactement les mêmes clés.
// Les clés sont préfixées par la zone (« landing.», « analyse.», « docs.», « app.»…).
import { app } from "./app";
import { analyse } from "./analyse";
import { common } from "./common";
import { documents } from "./documents";
import { landing } from "./landing";

const parts = [common, landing, analyse, documents, app] as { fr: object; en: object }[];

type Dict = Record<string, string>;
function merge(lang: "fr" | "en"): Dict {
  return Object.assign({}, ...parts.map((p) => p[lang]));
}

export const messages = { fr: merge("fr"), en: merge("en") } as const;
export type MessageKey = string;
