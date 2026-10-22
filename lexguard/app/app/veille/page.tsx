"use client";

import { useEffect, useState } from "react";
import type { VeilleItem } from "@/lib/types";
import { useI18n } from "@/components/lang-provider";

export default function VeillePage() {
  const { t, lang } = useI18n();
  const locale = lang === "en" ? "en-GB" : "fr-FR";
  const [items, setItems] = useState<VeilleItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/veille")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json() as Promise<{ items: VeilleItem[] }>;
        })
        .then((data) => {
          if (!alive) return;
          setItems(data.items);
          setError(false);
        })
        .catch(() => alive && setError(true));
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const impacted = items?.filter((i) => i.impacts.length > 0).length ?? 0;

  return (
    <div className="fl-container pt-12 pb-24">
      <p className="fl-eyebrow">{t("app.veille.eyebrow")}</p>
      <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="max-w-[20ch] text-[clamp(30px,4vw,48px)] tracking-[-0.035em]">{t("app.veille.title")}</h1>
        {items && (
          <div className="flex gap-2">
            <span className="fl-badge bg-card text-body">{t("app.veille.texts", { n: items.length })}</span>
            <span className={`fl-badge ${impacted ? "bg-red/10 text-red-deep" : "bg-card text-body"}`}>{t("app.veille.withImpact", { n: impacted })}</span>
          </div>
        )}
      </div>
      <p className="fl-lead mt-4 max-w-[60ch]">
        {t("app.veille.lead")}
      </p>

      <div className="mt-10 flex flex-col gap-3">
        {error && !items && <Empty>{t("app.veille.unreachable")}</Empty>}
        {!error && !items && <Empty>{t("app.veille.loading")}</Empty>}
        {items?.length === 0 && <Empty>{t("app.veille.empty")}</Empty>}
        {items?.map((item) => (
          <article key={item.id} className="fl-card p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              {item.nature && <span className="fl-badge bg-card text-ink">{item.nature.toLowerCase()}</span>}
              {item.date_publi && <span className="text-muted">{t("app.veille.joOf", { date: new Date(item.date_publi).toLocaleDateString(locale) })}</span>}
              {item.impacts.length > 0 && <span className="fl-badge bg-red/10 text-red-deep">{t("app.veille.impacts", { n: item.impacts.length })}</span>}
            </div>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 block text-[18px] leading-snug tracking-[-0.015em] hover:text-red">
              {item.title}
            </a>
            {item.modifies.length > 0 && (
              <p className="mt-3 text-[13px] text-body">
                {t("app.veille.modifies")} <span className="fl-mono text-[12px]">{item.modifies.slice(0, 8).join(", ")}{item.modifies.length > 8 ? ` +${item.modifies.length - 8}` : ""}</span>
              </p>
            )}
            {item.impacts.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
                {item.impacts.map((impact, i) => (
                  <li key={i} className="rounded-[10px] bg-warm px-4 py-3 text-[14px]">
                    <span className="font-medium">{impact.collectivite}</span>
                    <span className="text-muted"> · {impact.act_title}</span>
                    <p className="mt-1 text-body">{impact.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[16px] bg-warm px-6 py-10 text-center text-[15px] text-body">{children}</div>;
}
