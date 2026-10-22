"use client";

import { useEffect, useState } from "react";
import type { Stats } from "@/lib/types";

const fmt = (n: number | undefined | null) => (n == null ? "—" : new Intl.NumberFormat("fr-FR").format(n));

export default function DonneesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/stats")
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json() as Promise<Stats>;
        })
        .then((s) => {
          if (!alive) return;
          setStats(s);
          setError(false);
          setUpdatedAt(new Date());
        })
        .catch(() => alive && setError(true));
    load();
    const timer = setInterval(load, 3_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const counters = [
    { label: "Articles (toutes versions)", value: stats?.articles },
    { label: "Articles en vigueur", value: stats?.articles_en_vigueur },
    { label: "Liens du graphe des normes", value: stats?.links },
    { label: "Textes du Journal officiel", value: stats?.jo_texts },
    { label: "Actes locaux en mémoire", value: stats?.local_acts },
    { label: "Analyses", value: stats?.analyses },
    { label: "Alertes produites", value: stats?.findings },
    { label: "Retours de juristes", value: stats?.feedback },
  ];

  return (
    <div className="fl-container pt-12 pb-24">
      <p className="fl-eyebrow">Couche de données</p>
      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <h1 className="max-w-[20ch] text-[clamp(30px,4vw,48px)] tracking-[-0.035em]">Ce que les agents lisent, en direct</h1>
        <span className={`fl-badge self-start md:self-auto ${error ? "bg-red/10 text-red-deep" : "bg-ok/10 text-ok"}`}>
          <span className={`size-1.5 rounded-full ${error ? "bg-red" : "bg-ok fl-pulse"}`} />
          {error ? "base injoignable" : updatedAt ? `à jour ${updatedAt.toLocaleTimeString("fr-FR")}` : "connexion…"}
        </span>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {counters.map((c) => (
          <div key={c.label} className="fl-card px-5 py-5">
            <div className="text-[30px] font-medium leading-none tracking-[-0.03em] tabular-nums">{fmt(c.value)}</div>
            <div className="mt-2 text-[13px] text-body">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[13px] text-muted">
        Dernier Journal officiel ingéré : {stats?.last_jo_date ? new Date(stats.last_jo_date).toLocaleDateString("fr-FR") : "—"}
      </p>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="fl-card overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 text-[15px] tracking-normal">Codes indexés</h2>
          <table className="w-full text-[14px]">
            <tbody>
              {(stats?.codes ?? []).map((code) => (
                <tr key={code.code_id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">
                    <a href={`https://www.legifrance.gouv.fr/codes/texte_lc/${code.code_id}`} target="_blank" rel="noopener noreferrer" className="hover:text-red">
                      {code.code_title}
                    </a>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-body">{fmt(code.articles)}</td>
                </tr>
              ))}
              {!stats?.codes?.length && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted">Aucun code indexé pour l&apos;instant.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-[16px] bg-[#0a0a0a] text-white">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <h2 className="text-[15px] tracking-normal text-white">Journal des requêtes en direct</h2>
            <span className="fl-mono text-[11px] text-white/40">query_log</span>
          </div>
          <ol className="fl-mono max-h-[520px] overflow-y-auto px-5 py-3 text-[12px] leading-relaxed">
            {(stats?.recent_queries ?? []).map((q, i) => (
              <li key={`${q.ts}-${i}`} className="grid grid-cols-[64px_1fr] gap-3 border-b border-white/5 py-2 last:border-0 sm:grid-cols-[64px_96px_1fr_auto]">
                <span className="text-white/40">{new Date(q.ts).toLocaleTimeString("fr-FR")}</span>
                <span className="text-[#ff6b6b] max-sm:hidden">{q.actor}</span>
                <span className="min-w-0 break-words text-white/85">
                  <span className="text-white/50">{q.kind} · </span>
                  {q.detail}
                </span>
                <span className="text-right text-white/40 max-sm:col-start-2 max-sm:text-left">
                  {q.rows} lignes · {q.ms} ms
                </span>
              </li>
            ))}
            {!stats?.recent_queries?.length && <li className="py-8 text-center text-white/40">Aucune requête pour l&apos;instant.</li>}
          </ol>
        </section>
      </div>
    </div>
  );
}
