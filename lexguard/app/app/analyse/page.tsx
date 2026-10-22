"use client";

import { AnimatePresence, motion } from "motion/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AGENT_STYLE, SEVERITY_LABEL, VERDICT_STYLE } from "@/components/agent-style";
import { Arrow } from "@/components/ui/arrow";
import type { AgentEvent, Analysis, Finding, Verdict } from "@/lib/types";
import type { ModalCheckResult, ModalFinding } from "@/lib/agents/modal-client";

const EXAMPLE = {
  title: "Arrêté n° 2026-045 — produits phytopharmaceutiques et tranquillité publique",
  collectivite: "Commune de Saint-Exemple (35)",
  date: "2026-10-22",
  text: `RÉPUBLIQUE FRANÇAISE — COMMUNE DE SAINT-EXEMPLE

ARRÊTÉ MUNICIPAL N° 2026-045
portant réglementation de l'utilisation des produits phytopharmaceutiques, de la consommation d'alcool sur la voie publique et du brûlage des déchets verts

Le Maire de la commune de Saint-Exemple,

Vu le code général des collectivités territoriales, notamment ses articles L. 2212-1 et L. 2212-2 ;
Vu le code rural et de la pêche maritime, notamment ses articles L. 253-1 et suivants ;
Vu le code de l'environnement, notamment son article L. 110-1 ;
Vu le code de la santé publique ;

Considérant que l'exposition des riverains aux produits phytopharmaceutiques présente un risque pour la santé publique ;
Considérant les nuisances constatées place de la Mairie en soirée ;

ARRÊTE :

Article 1 — L'utilisation de produits phytopharmaceutiques est interdite sur l'ensemble du territoire communal à une distance inférieure à 150 mètres de toute parcelle comprenant un bâtiment à usage d'habitation ou professionnel.

Article 2 — La consommation de boissons alcoolisées est interdite sur la place de la Mairie et ses abords immédiats, tous les jours de 22 heures à 7 heures, du 1er novembre 2026 au 31 mars 2027.

Article 3 — Le brûlage à l'air libre des déchets verts produits par les particuliers est interdit en tout temps sur le territoire de la commune.

Article 4 — Les infractions au présent arrêté seront constatées par procès-verbal et punies de l'amende prévue pour les contraventions de première classe.

Article 5 — Le présent arrêté peut faire l'objet d'un recours devant le tribunal administratif de Rennes dans un délai de deux mois à compter de sa publication.

Fait à Saint-Exemple, le 22 octobre 2026.
Le Maire`,
};

type Phase = "saisie" | "analyse" | "termine" | "modal";

export default function AnalysePage() {
  return (
    <Suspense>
      <AnalyseView />
    </Suspense>
  );
}

function AnalyseView() {
  // Reprise d'une analyse via ?id=… (lien partageable).
  const initialId = useSearchParams().get("id");
  const [title, setTitle] = useState("");
  const [collectivite, setCollectivite] = useState("");
  const [dateActe, setDateActe] = useState("");
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>(initialId ? "analyse" : "saisie");
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(initialId);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [modalResult, setModalResult] = useState<ModalCheckResult | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  const loadResult = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/analyses/${id}`);
      if (!res.ok) throw new Error(`Réponse ${res.status}`);
      const data = (await res.json()) as { analysis: Analysis; findings: Finding[] };
      setAnalysis(data.analysis);
      setFindings(data.findings);
      if (data.analysis.status !== "en_cours") setPhase("termine");
      return data.analysis;
    } catch (e) {
      setError(`Impossible de charger le résultat (${e instanceof Error ? e.message : "erreur réseau"}).`);
      return null;
    }
  }, []);

  const follow = useCallback(
    (id: string) => {
      sourceRef.current?.close();
      const source = new EventSource(`/api/analyses/${id}/stream`);
      sourceRef.current = source;
      source.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as AgentEvent;
          setEvents((prev) => (prev.some((e) => e.id === event.id) ? prev : [...prev, event]));
          if (event.type === "fin") {
            source.close();
            void loadResult(id);
          }
        } catch {
          /* ligne SSE non JSON (ping) : ignorée */
        }
      };
      source.onerror = () => {
        // Le navigateur relance seul ; si la connexion est fermée, on récupère l'état final.
        if (source.readyState === EventSource.CLOSED) void loadResult(id);
      };
    },
    [loadResult],
  );

  useEffect(() => {
    const id = initialId;
    if (!id) return;
    // Le flux rejoue tous les événements depuis le début : la timeline se reconstruit même pour une analyse terminée.
    // loadResult ne met l'état à jour qu'après la réponse réseau (asynchrone).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadResult(id).then(() => follow(id));
    return () => sourceRef.current?.close();
  }, [initialId, follow, loadResult]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (input.trim().length < 40) {
      setError("Collez le texte complet de l'acte (au moins quelques lignes).");
      return;
    }
    setEvents([]);
    setFindings([]);
    setAnalysis(null);
    setPhase("analyse");
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || "Acte sans titre",
          input,
          collectivite: collectivite.trim() || undefined,
          date_acte: dateActe || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Réponse ${res.status}`);
      const { id } = (await res.json()) as { id: string };
      setAnalysisId(id);
      window.history.replaceState(null, "", `/app/analyse?id=${id}`);
      follow(id);
    } catch (err) {
      setPhase("saisie");
      setError(`L'analyse n'a pas pu démarrer : ${err instanceof Error ? err.message : "erreur réseau"}.`);
    }
  }

  async function submitModal() {
    setError(null);
    if (input.trim().length < 40) {
      setError("Collez le texte complet de l'acte (au moins quelques lignes).");
      return;
    }
    setModalResult(null);
    setModalBusy(true);
    setPhase("modal");
    try {
      const res = await fetch("/api/analyses/modal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Réponse ${res.status}`);
      }
      setModalResult((await res.json()) as ModalCheckResult);
    } catch (err) {
      setPhase("saisie");
      setError(`L'analyse via Modal a échoué : ${err instanceof Error ? err.message : "erreur réseau"}.`);
    } finally {
      setModalBusy(false);
    }
  }

  function reset() {
    sourceRef.current?.close();
    setPhase("saisie");
    setEvents([]);
    setFindings([]);
    setAnalysis(null);
    setAnalysisId(null);
    setModalResult(null);
    setModalBusy(false);
    window.history.replaceState(null, "", "/app/analyse");
  }

  return (
    <div className="fl-container pt-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="fl-eyebrow">Contrôle d&apos;un acte</p>
          <h1 className="mt-3 text-[clamp(30px,4vw,48px)] tracking-[-0.035em]">Vérifier un arrêté avant signature</h1>
        </div>
        {phase !== "saisie" && (
          <button type="button" onClick={reset} className="fl-btn fl-btn--ghost fl-btn--sm self-start md:self-auto">
            Nouvelle analyse
          </button>
        )}
      </div>

      {error && <div className="mt-6 rounded-[10px] border border-red/30 bg-red/5 px-4 py-3 text-[14px] text-red-deep">{error}</div>}

      {phase === "saisie" ? (
        <form onSubmit={submit} className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="fl-card p-5 md:p-6">
            <label className="block text-[13px] font-medium text-body" htmlFor="acte">
              Texte de l&apos;acte
            </label>
            <textarea
              id="acte"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Collez ici le projet d'arrêté ou de délibération…"
              className="fl-input mt-2 min-h-[420px] resize-y font-mono text-[13px] leading-relaxed"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="fl-card flex flex-col gap-4 p-5">
              <Field label="Titre" htmlFor="titre">
                <input id="titre" className="fl-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Arrêté n° …" />
              </Field>
              <Field label="Collectivité" htmlFor="coll">
                <input id="coll" className="fl-input" value={collectivite} onChange={(e) => setCollectivite(e.target.value)} placeholder="Commune de …" />
              </Field>
              <Field label="Date de l'acte" htmlFor="date">
                <input id="date" type="date" className="fl-input" value={dateActe} onChange={(e) => setDateActe(e.target.value)} />
              </Field>
            </div>
            <button type="submit" className="fl-btn fl-btn--red w-full">
              Lancer les agents
              <Arrow size={14} />
            </button>
            <button type="button" onClick={submitModal} className="fl-btn fl-btn--ghost w-full">
              Analyser via Modal ⚡
            </button>
            <button
              type="button"
              className="fl-btn fl-btn--ghost w-full"
              onClick={() => {
                setTitle(EXAMPLE.title);
                setCollectivite(EXAMPLE.collectivite);
                setDateActe(EXAMPLE.date);
                setInput(EXAMPLE.text);
              }}
            >
              Charger un exemple
            </button>
            <p className="text-[13px] leading-relaxed text-muted">
              Cinq agents analysent l&apos;acte : découpage, recherche dans les codes en vigueur, jugement, contradiction, rédaction. Comptez une à trois minutes.
            </p>
          </div>
        </form>
      ) : phase === "modal" ? (
        <ModalResults result={modalResult} busy={modalBusy} />
      ) : (
        <div className="mt-10 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Timeline events={events} running={phase === "analyse"} />
          <Results analysis={analysis} findings={findings} running={phase === "analyse"} analysisId={analysisId} />
        </div>
      )}
    </div>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-body">
        {label}
      </label>
      {children}
    </div>
  );
}

function Timeline({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }), [events.length]);

  return (
    <aside className="fl-card flex max-h-[78vh] flex-col overflow-hidden lg:sticky lg:top-24">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <span className="text-[15px] font-medium">Travail des agents</span>
        {running ? (
          <span className="fl-badge fl-pulse bg-red/10 text-red-deep">en cours</span>
        ) : (
          <span className="fl-badge bg-card text-body">{events.length} étapes</span>
        )}
      </div>
      <ol className="flex-1 overflow-y-auto px-5 py-4">
        {events.length === 0 && <li className="py-6 text-center text-[14px] text-muted">Démarrage des agents…</li>}
        <AnimatePresence initial={false}>
          {events.map((event) => {
            const style = AGENT_STYLE[event.agent] ?? AGENT_STYLE.orchestrateur;
            return (
              <motion.li
                key={event.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative flex gap-3 pb-3.5 pl-0.5"
              >
                <span className={`mt-[7px] size-2 shrink-0 rounded-full ${style.dot}`} />
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium">{style.label}</span>
                    <span className="fl-mono text-[11px] text-muted">{new Date(event.ts).toLocaleTimeString("fr-FR")}</span>
                  </div>
                  <p
                    className={`text-[13px] leading-snug break-words ${
                      event.type === "outil" ? "fl-mono text-[12px] text-muted" : event.type === "rejet" || event.type === "erreur" ? "text-red-deep" : "text-body"
                    }`}
                  >
                    {event.message}
                  </p>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </ol>
    </aside>
  );
}

const ORDER: Verdict[] = ["conflit", "incompetence", "vide", "doublon", "conforme"];

function Results({ analysis, findings, running, analysisId }: { analysis: Analysis | null; findings: Finding[]; running: boolean; analysisId: string | null }) {
  if (running && !analysis?.summary) {
    return (
      <section className="flex min-h-[320px] flex-col items-center justify-center rounded-[16px] bg-warm px-6 text-center">
        <span className="size-3 rounded-full bg-red fl-pulse" />
        <p className="mt-5 text-[17px]">Les agents examinent l&apos;acte…</p>
        <p className="mt-2 max-w-[42ch] text-[14px] text-body">Les alertes apparaîtront ici, chacune avec l&apos;article exact et son extrait vérifié.</p>
      </section>
    );
  }

  if (analysis?.status === "erreur") {
    return (
      <section className="rounded-[16px] border border-red/30 bg-red/5 p-6 text-red-deep">
        L&apos;analyse a échoué. Consultez le journal des agents pour le détail{analysisId ? ` (analyse ${analysisId.slice(0, 8)})` : ""}.
      </section>
    );
  }

  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const alerts = sorted.filter((f) => f.verdict !== "conforme" && !f.rejection_reason);
  const others = sorted.filter((f) => f.verdict === "conforme" || f.rejection_reason);
  const summary = analysis?.summary;

  return (
    <section className="flex flex-col gap-5">
      {summary && (
        <div className="fl-card p-6">
          <p className="fl-eyebrow">Synthèse</p>
          <p className="mt-3 text-[20px] leading-snug tracking-[-0.015em]">{summary.headline}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {ORDER.map((v) =>
              summary.counts?.[v] ? (
                <span key={v} className={`fl-badge ${VERDICT_STYLE[v].className}`}>
                  {summary.counts[v]} {VERDICT_STYLE[v].label.toLowerCase()}
                </span>
              ) : null,
            )}
            {summary.rejected > 0 && <span className="fl-badge bg-card text-body">{summary.rejected} écartée(s) par le contradicteur</span>}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-[13px] text-body">
            <Metric label="Articles consultés" value={String(summary.articles_consulted ?? "—")} />
            <Metric label="Durée" value={analysis?.latency_ms != null ? `${Math.round(analysis.latency_ms / 1000)} s` : "—"} />
            <Metric label="Coût" value={analysis?.cost_usd != null ? `${Number(analysis.cost_usd).toFixed(2)} $` : "—"} />
          </div>
        </div>
      )}

      {alerts.length === 0 && !running && (
        <div className="rounded-[16px] bg-warm p-6 text-[15px] text-body">Aucune alerte retenue : l&apos;acte paraît conforme au droit en vigueur consulté.</div>
      )}
      {alerts.map((finding) => (
        <FindingCard key={finding.id} finding={finding} />
      ))}

      {others.length > 0 && (
        <details className="rounded-[16px] border border-line p-5">
          <summary className="cursor-pointer text-[14px] font-medium text-body">
            {others.length} disposition(s) conforme(s) ou alerte(s) écartée(s)
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {others.map((finding) => (
              <FindingCard key={finding.id} finding={finding} compact />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="mt-0.5 text-[16px] font-medium text-ink tabular-nums">{value}</div>
    </div>
  );
}

function FindingCard({ finding, compact = false }: { finding: Finding; compact?: boolean }) {
  const [feedback, setFeedback] = useState<"valide" | "rejete" | null>(null);
  const [sending, setSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const verdict = VERDICT_STYLE[finding.verdict];

  async function send(decision: "valide" | "rejete") {
    let reason: string | undefined;
    if (decision === "rejete") reason = window.prompt("Pourquoi est-ce un faux positif ? (facultatif)") ?? undefined;
    setSending(true);
    setFeedbackError(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finding_id: finding.id, decision, reason }),
      });
      if (!res.ok) throw new Error();
      setFeedback(decision);
    } catch {
      setFeedbackError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.article initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`fl-card ${compact ? "p-5 shadow-none" : "p-6"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`fl-badge ${verdict.className}`}>{verdict.label}</span>
        {finding.verdict !== "conforme" && <span className="fl-badge bg-card text-body">{SEVERITY_LABEL[finding.severity]}</span>}
        {finding.verified && !finding.rejection_reason && (
          <span className="fl-badge bg-ok/10 text-ok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Citations vérifiées
          </span>
        )}
        {finding.rejection_reason && <span className="fl-badge bg-card text-muted">Écartée</span>}
      </div>

      <h3 className={`mt-4 leading-snug tracking-[-0.02em] ${compact ? "text-[17px]" : "text-[21px]"}`}>{finding.title}</h3>
      <blockquote className="mt-3 border-l-2 border-line-2 pl-3 text-[13px] italic text-muted">{finding.disposition.text}</blockquote>
      <p className="mt-4 text-[15px] leading-relaxed text-body">{finding.explanation}</p>

      {finding.rejection_reason && (
        <p className="mt-3 rounded-[10px] bg-card px-3 py-2 text-[13px] text-body">Motif du rejet : {finding.rejection_reason}</p>
      )}

      {finding.citations.length > 0 && (
        <div className="mt-5 flex flex-col gap-2.5">
          {finding.citations.map((citation) => (
            <a
              key={`${citation.article_id}-${citation.quote.slice(0, 20)}`}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-[10px] border border-line bg-warm px-4 py-3 transition-colors hover:border-line-2 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">
                  Art. {citation.num} · <span className="text-body">{citation.code}</span>
                </span>
                <span className="fl-mono shrink-0 text-[11px] text-muted group-hover:text-red">Légifrance ↗</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-body">« {citation.quote} »</p>
            </a>
          ))}
        </div>
      )}

      {finding.suggestion && !compact && (
        <div className="mt-5 rounded-[10px] border border-ok/25 bg-ok/5 px-4 py-3">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-ok">Rédaction proposée</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink">{finding.suggestion}</p>
        </div>
      )}

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          {feedback ? (
            <span className="text-[13px] text-body">
              {feedback === "valide" ? "Merci : alerte confirmée, ajoutée à la doctrine interne." : "Merci : faux positif enregistré, les agents en tiendront compte."}
            </span>
          ) : (
            <>
              <span className="mr-1 text-[13px] text-muted">Cette alerte est-elle juste ?</span>
              <button type="button" disabled={sending} onClick={() => send("valide")} className="fl-btn fl-btn--ghost fl-btn--sm">
                ✓ Pertinent
              </button>
              <button type="button" disabled={sending} onClick={() => send("rejete")} className="fl-btn fl-btn--ghost fl-btn--sm">
                ✗ Faux positif
              </button>
              {feedbackError && <span className="text-[13px] text-red-deep">Envoi impossible, réessayez.</span>}
            </>
          )}
        </div>
      )}
    </motion.article>
  );
}

// Rendu du résultat du moteur Python exécuté sur Modal (schéma agents/orchestrator.py).
const MODAL_VERDICT: Record<ModalFinding["type"], { label: string; className: string }> = {
  conflit: { label: "Conflit", className: "bg-red/10 text-red-deep" },
  doublon: { label: "Doublon", className: "bg-card text-body" },
  vide: { label: "Vide juridique", className: "bg-card text-muted" },
  compatible: { label: "Compatible", className: "bg-ok/10 text-ok" },
};
const MODAL_ORDER: ModalFinding["type"][] = ["conflit", "doublon", "vide", "compatible"];

function ModalResults({ result, busy }: { result: ModalCheckResult | null; busy: boolean }) {
  if (busy && !result) {
    return (
      <section className="mt-10 flex min-h-[320px] flex-col items-center justify-center rounded-[16px] bg-warm px-6 text-center">
        <span className="size-3 rounded-full bg-red fl-pulse" />
        <p className="mt-5 text-[17px]">Analyse exécutée sur Modal ⚡ (agents Python + Keenable)…</p>
        <p className="mt-2 max-w-[46ch] text-[14px] text-body">Chaque citation est un article réel récupéré sur Légifrance / EUR-Lex, puis vérifié mot pour mot.</p>
      </section>
    );
  }
  if (!result) return null;
  const sorted = [...result.findings].sort((a, b) => MODAL_ORDER.indexOf(a.type) - MODAL_ORDER.indexOf(b.type));

  return (
    <section className="mt-10 flex flex-col gap-5">
      <div className="fl-card p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="fl-eyebrow">Synthèse · exécutée sur Modal ⚡</p>
          {result.rejected_citations > 0 && <span className="fl-badge bg-card text-body">{result.rejected_citations} citation(s) écartée(s)</span>}
        </div>
        <p className="mt-3 text-[18px] leading-snug tracking-[-0.015em]">{result.summary}</p>
      </div>

      {sorted.length === 0 && <div className="rounded-[16px] bg-warm p-6 text-[15px] text-body">Aucune obligation vérifiable n&apos;a été détectée.</div>}

      {sorted.map((finding, i) => {
        const verdict = MODAL_VERDICT[finding.type];
        return (
          <motion.article key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="fl-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`fl-badge ${verdict.className}`}>{verdict.label}</span>
              <span className="fl-badge bg-card text-body">confiance {Math.round(finding.confidence * 100)} %</span>
            </div>
            <h3 className="mt-4 text-[21px] leading-snug tracking-[-0.02em]">{finding.obligation}</h3>
            <p className="mt-4 text-[15px] leading-relaxed text-body">{finding.explanation}</p>
            {finding.citations.length > 0 && (
              <div className="mt-5 flex flex-col gap-2.5">
                {finding.citations.map((citation, j) => (
                  <a
                    key={j}
                    href={citation.url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-[10px] border border-line bg-warm px-4 py-3 transition-colors hover:border-line-2 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[13px] font-medium">
                        {citation.ref}
                        {citation.version_date ? <span className="text-muted"> · {citation.version_date}</span> : null}
                      </span>
                      <span className="fl-mono shrink-0 text-[11px] text-muted group-hover:text-red">source ↗</span>
                    </div>
                    {citation.excerpt && <p className="mt-1.5 text-[13px] leading-relaxed text-body">« {citation.excerpt} »</p>}
                  </a>
                ))}
              </div>
            )}
          </motion.article>
        );
      })}
    </section>
  );
}
