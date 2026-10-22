"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Arrow } from "@/components/ui/arrow";
import type { JoAuditResult, JoAuditText, ModalFinding } from "@/lib/agents/modal-client";

const VERDICT: Record<ModalFinding["type"], { label: string; className: string }> = {
  conflit: { label: "Conflit", className: "bg-red/10 text-red-deep" },
  doublon: { label: "Doublon", className: "bg-card text-body" },
  vide: { label: "Vide juridique", className: "bg-card text-muted" },
  compatible: { label: "Compatible", className: "bg-ok/10 text-ok" },
};
const ORDER: ModalFinding["type"][] = ["conflit", "doublon", "vide", "compatible"];

export default function VeilleJoPage() {
  const [date, setDate] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [maxTexts, setMaxTexts] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JoAuditResult | null>(null);

  async function run() {
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Choisissez une date de début (AAAA-MM-JJ).");
      return;
    }
    setResult(null);
    setBusy(true);
    try {
      const body = dateTo ? { date_from: date, date_to: dateTo, max_texts: maxTexts } : { date, max_texts: maxTexts };
      const res = await fetch("/api/jo-audit", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Réponse ${res.status}`);
      }
      setResult((await res.json()) as JoAuditResult);
    } catch (e) {
      setError(`Audit impossible : ${e instanceof Error ? e.message : "erreur réseau"}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fl-container pt-12">
      <p className="fl-eyebrow">Audit du Journal Officiel</p>
      <h1 className="mt-3 text-[clamp(30px,4vw,48px)] tracking-[-0.035em]">Conformité du JO par date</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-body">
        Chaque loi, décret et arrêté publié à la date (ou sur la période) choisie est confronté au droit en vigueur
        national et européen. Exécuté sur Modal, sources récupérées via Keenable.
      </p>

      {error && <div className="mt-6 rounded-[10px] border border-red/30 bg-red/5 px-4 py-3 text-[14px] text-red-deep">{error}</div>}

      <div className="mt-8 flex flex-wrap items-end gap-4 rounded-[14px] border border-line bg-warm p-5">
        <label className="text-[13px] font-medium text-body">
          Date (ou début de période)
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="fl-input mt-1.5 block" />
        </label>
        <label className="text-[13px] font-medium text-body">
          Fin de période (optionnel)
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="fl-input mt-1.5 block" />
        </label>
        <label className="text-[13px] font-medium text-body">
          Textes max
          <input type="number" min={1} max={60} value={maxTexts} onChange={(e) => setMaxTexts(Number(e.target.value) || 1)} className="fl-input mt-1.5 block w-24" />
        </label>
        <button type="button" onClick={run} disabled={busy} className="fl-btn fl-btn--red">
          {busy ? "Audit en cours…" : "Lancer l'audit"}
          {!busy && <Arrow size={14} />}
        </button>
      </div>

      {busy && !result && (
        <div className="mt-8 flex min-h-[240px] flex-col items-center justify-center rounded-[16px] bg-warm px-6 text-center">
          <span className="size-3 rounded-full bg-red fl-pulse" />
          <p className="mt-5 text-[17px]">Audit du Journal Officiel sur Modal…</p>
          <p className="mt-2 max-w-[46ch] text-[14px] text-body">Chaque texte est analysé puis confronté au droit en vigueur (national + UE). Comptez quelques minutes.</p>
        </div>
      )}

      {result && <AuditResult result={result} />}
    </div>
  );
}

function AuditResult({ result }: { result: JoAuditResult }) {
  return (
    <section className="mt-8 flex flex-col gap-5">
      <div className="fl-card p-6">
        <p className="fl-eyebrow">Synthèse · {result.dates.join(" → ")}</p>
        <p className="mt-3 text-[18px] leading-snug">{result.texts_count} texte(s) analysé(s).</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {ORDER.map((v) =>
            result.counts?.[v] ? (
              <span key={v} className={`fl-badge ${VERDICT[v].className}`}>
                {result.counts[v]} {VERDICT[v].label.toLowerCase()}
              </span>
            ) : null,
          )}
          {result.rejected_citations > 0 && <span className="fl-badge bg-card text-body">{result.rejected_citations} citation(s) écartée(s)</span>}
        </div>
      </div>

      {result.texts.length === 0 && <div className="rounded-[16px] bg-warm p-6 text-[15px] text-body">Aucun texte substantiel trouvé pour cette date.</div>}
      {result.texts.map((t) => (
        <TextCard key={t.id} text={t} />
      ))}
    </section>
  );
}

function TextCard({ text }: { text: JoAuditText }) {
  const sorted = [...text.findings].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type));
  const alerts = sorted.filter((f) => f.type !== "compatible");
  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fl-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="fl-badge bg-card text-body">{text.nature}</span>
        {alerts.length === 0 ? (
          <span className="fl-badge bg-ok/10 text-ok">Conforme au droit consulté</span>
        ) : (
          <span className="fl-badge bg-red/10 text-red-deep">{alerts.length} alerte(s)</span>
        )}
      </div>
      <h3 className="mt-3 text-[18px] leading-snug tracking-[-0.02em]">
        <a href={text.url} target="_blank" rel="noopener noreferrer" className="hover:text-red">
          {text.title} <span className="fl-mono text-[11px] text-muted">↗</span>
        </a>
      </h3>
      {text.summary && <p className="mt-3 text-[14px] leading-relaxed text-body">{text.summary}</p>}

      {sorted.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
          {sorted.map((f, i) => (
            <div key={i}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`fl-badge ${VERDICT[f.type].className}`}>{VERDICT[f.type].label}</span>
                <span className="fl-badge bg-card text-body">confiance {Math.round(f.confidence * 100)} %</span>
                <span className="text-[13px] text-muted">{f.obligation}</span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-body">{f.explanation}</p>
              {f.citations.map((c, j) => (
                <a key={j} href={c.url ?? "#"} target="_blank" rel="noopener noreferrer" className="group mt-2 block rounded-[10px] border border-line bg-warm px-4 py-2.5 transition-colors hover:border-line-2 hover:bg-white">
                  <span className="text-[13px] font-medium">
                    {c.ref}
                    {c.version_date ? <span className="text-muted"> · {c.version_date}</span> : null}
                    <span className="fl-mono ml-2 text-[11px] text-muted group-hover:text-red">source ↗</span>
                  </span>
                  {c.excerpt && <p className="mt-1 text-[13px] leading-relaxed text-body">« {c.excerpt} »</p>}
                </a>
              ))}
            </div>
          ))}
        </div>
      )}
    </motion.article>
  );
}
