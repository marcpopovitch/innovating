"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/lang-provider";
import type { Stats } from "@/lib/types";

/** Compteurs lus en direct dans la couche de données (« — » si l'API ne répond pas). */
export function LiveStats() {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  const fmt = (n: number | undefined) => (n == null ? "—" : new Intl.NumberFormat(locale).format(n));
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((s: Stats | null) => alive && s && setStats(s))
        .catch(() => {});
    load();
    const timer = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const items = [
    { value: fmt(stats?.articles_en_vigueur), label: t("landing.stats.articles") },
    { value: fmt(stats?.links), label: t("landing.stats.links") },
    { value: fmt(stats?.jo_texts), label: t("landing.stats.jo") },
    { value: fmt(stats?.local_acts), label: t("landing.stats.local") },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="fl-card px-5 py-6">
          <div className="text-[34px] font-medium leading-none tracking-[-0.03em] tabular-nums">{item.value}</div>
          <div className="mt-2 text-[14px] text-body">{item.label}</div>
        </div>
      ))}
      <p className="col-span-2 text-[13px] text-muted md:col-span-4">
        {stats?.last_jo_date ? t("landing.stats.lastJo", { date: new Date(stats.last_jo_date).toLocaleDateString(locale) }) : t("landing.stats.live")}
      </p>
    </div>
  );
}
