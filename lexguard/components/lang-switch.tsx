"use client";

import { useRouter } from "next/navigation";
import { LANG_COOKIE } from "@/lib/i18n/config";
import { useI18n } from "@/components/lang-provider";

export function LangSwitch() {
  const { lang, t } = useI18n();
  const router = useRouter();
  const next = lang === "fr" ? "en" : "fr";

  function change() {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <button type="button" onClick={change} className="text-[14px] text-body hover:text-ink" lang={next}>
      {t("lang.switch")}
    </button>
  );
}
