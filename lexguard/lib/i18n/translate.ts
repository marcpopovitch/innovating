import type { Lang } from "./config";
import { messages, type MessageKey } from "./messages";

export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

// Remplace {nom} par vars.nom. Le français sert de repli si une clé manque en anglais.
export function makeT(lang: Lang): T {
  return (key, vars) => {
    const text = messages[lang][key] ?? messages.fr[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : text;
  };
}
