"use client";

// Espace Analyse : on dépose un document (ou un dossier), les agents le contrôlent aussitôt
// (globe animé), puis les résultats s'affichent. Pas de saisie ni de questions.
import { AnimatePresence, motion } from "motion/react";
import { createContext, Suspense, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AGENT_STYLE, SEVERITY_LABEL, VERDICT_STYLE } from "@/components/agent-style";
import { type Document, DocumentDrop, MODE_LABEL } from "@/components/document-drop";
import { AgentWork, FolderIcon } from "@/components/agent-work";
import { BrickMascot } from "@/components/brick-mascot";
import { ArticleViewer, type ViewerTarget } from "@/components/article-viewer";
import { MODEL_CHOICES, type AgentEvent, type Analysis, type Finding, type Mode, type ModelId, type Verdict } from "@/lib/types";

const EXAMPLE = `RÉPUBLIQUE FRANÇAISE — COMMUNE DE SAINT-EXEMPLE

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

Fait à Saint-Exemple, le 22 octobre 2026.
Le Maire`;

type Phase = "vide" | "lancement" | "analyse" | "termine";

// Cadrage appliqué d'office (plus de questions) : droit en vigueur, France + UE.
const CADRAGE = { periode: "Droit en vigueur aujourd'hui", perimetre: "France + droit de l'UE" };
// Un dossier peut contenir beaucoup d'actes : on en contrôle au plus 10 par dépôt (coût des modèles).
const MAX_PAR_DEPOT = 10;

interface ConversationItem {
  id: string;
  title: string;
  mode?: Mode;
  status: Analysis["status"];
  created_at: string;
}

// Ouvre le panneau « source » depuis n'importe quelle carte d'alerte.
const OpenSource = createContext<(t: ViewerTarget) => void>(() => {});

export default function AnalysePage() {
  const [source, setSource] = useState<ViewerTarget | null>(null);
  const close = useCallback(() => setSource(null), []);
  return (
    <OpenSource.Provider value={setSource}>
      <Suspense>
        <ChatView />
      </Suspense>
      <ArticleViewer target={source} onClose={close} />
    </OpenSource.Provider>
  );
}

function ChatView() {
  const initialId = useSearchParams().get("id");
  const [doc, setDoc] = useState<Document | null>(null);
  const [model, setModel] = useState<ModelId>("gpt-6-luna");
  const [mode, setMode] = useState<Mode>("controle");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<Phase>(initialId ? "analyse" : "vide");
  const [error, setError] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(initialId);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const [drawer, setDrawer] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/analyses");
      if (!res.ok) throw new Error();
      setConversations(((await res.json()) as { analyses: ConversationItem[] }).analyses);
    } catch {
      setConversations([]);
    }
  }, []);

  const loadResult = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/analyses/${id}`);
      if (!res.ok) throw new Error(`réponse ${res.status}`);
      const data = (await res.json()) as { analysis: Analysis; findings: Finding[] };
      setAnalysis(data.analysis);
      setFindings(data.findings);
      if (data.analysis.status !== "en_cours") setPhase("termine");
      return data.analysis;
    } catch (e) {
      setError(`Impossible de charger la conversation (${e instanceof Error ? e.message : "erreur réseau"}).`);
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
            void loadResult(id).then(() => loadConversations());
          }
        } catch {
          /* ligne SSE non JSON : ignorée */
        }
      };
      source.onerror = () => {
        if (source.readyState === EventSource.CLOSED) void loadResult(id);
      };
    },
    [loadResult, loadConversations],
  );

  // Ouverture d'une conversation existante (?id=…) : on rejoue cadrage, étapes et résultats.
  const openConversation = useCallback(
    async (id: string) => {
      sourceRef.current?.close();
      setError(null);
      setEvents([]);
      setFindings([]);
      setAnalysisId(id);
      setPhase("analyse");
      setDrawer(false);
      window.history.replaceState(null, "", `/app/analyse?id=${id}`);
      const a = await loadResult(id);
      if (!a) return;
      setDoc({ name: a.title, text: a.input });
      setMode(a.mode ?? "controle");
      setAnswers(a.cadrage ?? {});
      follow(id);
    },
    [follow, loadResult],
  );

  useEffect(() => {
    // Chargements réseau : l'état n'est mis à jour qu'à la réponse.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
    if (initialId) void openConversation(initialId);
    return () => sourceRef.current?.close();
  }, [initialId, loadConversations, openConversation]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [phase, findings.length]);

  function newConversation() {
    sourceRef.current?.close();
    setDoc(null);
    setAnswers({});
    setAnalysis(null);
    setFindings([]);
    setEvents([]);
    setAnalysisId(null);
    setError(null);
    setPhase("vide");
    setDrawer(false);
    window.history.replaceState(null, "", "/app/analyse");
  }

  // Documents déposés → une analyse (contrôle) par document, lancée tout de suite.
  // La première s'affiche ; les autres tournent en fond et apparaissent dans la liste.
  async function analyse(docs: Document[]) {
    const batch = docs.slice(0, MAX_PAR_DEPOT);
    sourceRef.current?.close();
    setError(null);
    setDoc(batch[0]);
    setAnswers(CADRAGE);
    setMode("controle");
    setAnalysis(null);
    setFindings([]);
    setEvents([]);
    setAnalysisId(null);
    setPhase("lancement");
    window.history.replaceState(null, "", "/app/analyse");
    try {
      const ids: string[] = [];
      for (const d of batch) {
        const res = await fetch("/api/analyses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: d.name.slice(0, 300), input: d.text, mode: "controle", model, cadrage: CADRAGE, collectivite: null, date_acte: null }),
        });
        if (res.status === 503) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Aucune clé de modèle côté serveur : ajoutez OPENROUTER_API_KEY (ou ANTHROPIC_API_KEY) dans lexguard/.env puis relancez le serveur.");
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(`${d.name} : ${body?.error ?? `réponse ${res.status}`}`);
        }
        ids.push(((await res.json()) as { id: string }).id);
        if (ids.length === 1) {
          setAnalysisId(ids[0]);
          setPhase("analyse");
          window.history.replaceState(null, "", `/app/analyse?id=${ids[0]}`);
          follow(ids[0]);
        }
      }
      if (docs.length > MAX_PAR_DEPOT) setError(`${docs.length} documents déposés : seuls les ${MAX_PAR_DEPOT} premiers sont analysés.`);
    } catch (e) {
      setPhase((p) => (p === "lancement" ? "vide" : p));
      setError(e instanceof Error ? e.message : "Les agents n'ont pas pu démarrer.");
    }
    void loadConversations();
  }

  const busy = phase === "lancement" || phase === "analyse";
  const empty = phase === "vide";

  const drop = (compact: boolean) => (
    <DocumentDrop onDocuments={analyse} onExample={() => analyse([{ name: "Exemple — arrêté municipal n° 2026-045", text: EXAMPLE }])} disabled={busy} model={model} onModel={setModel} compact={compact} />
  );

  return (
    <div className="flex min-h-[calc(100dvh-64px)]">
      <ConversationList
        items={conversations}
        activeId={analysisId}
        open={drawer}
        onClose={() => setDrawer(false)}
        onNew={newConversation}
        onOpen={openConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-4 pt-4 lg:hidden">
          <button type="button" onClick={() => setDrawer(true)} className="fl-btn fl-btn--ghost fl-btn--sm" aria-label="Ouvrir les conversations">
            Conversations
          </button>
          {!empty && (
            <button type="button" onClick={newConversation} className="fl-btn fl-btn--ghost fl-btn--sm">
              Nouvelle
            </button>
          )}
        </div>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 pb-24">
            <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center text-[clamp(30px,4.4vw,48px)] font-medium tracking-[-0.035em]">
              Quel acte voulez-vous vérifier aujourd’hui ?
            </motion.h1>
            <p className="mt-3 max-w-[52ch] text-center text-[15px] text-body">
              Déposez-le : il est contrôlé aussitôt contre tout le droit en vigueur.
            </p>
            <div className="mt-10 w-full max-w-[760px]">{drop(false)}</div>
            {error && <div className="mt-6 max-w-[760px] rounded-[12px] border border-red/30 bg-red/5 px-4 py-3 text-[14px] text-red-deep">{error}</div>}
          </div>
        ) : (
          <>
            <div className="mx-auto w-full max-w-[760px] flex-1 px-4 pt-8 pb-10">
              {doc && <DocumentBubble doc={doc} />}

              {phase === "lancement" && <AssistantTyping label="Je lance les agents…" />}

              {(phase === "analyse" || phase === "termine") && (
                <>
                  <CadrageSummary answers={answers} mode={analysis?.mode ?? mode} model={analysis?.model ?? model} />
                  <WorkBlock events={events} running={phase === "analyse"} />
                  {phase === "termine" && <Results analysis={analysis} findings={findings} />}
                </>
              )}

              {error && <div className="mt-6 rounded-[12px] border border-red/30 bg-red/5 px-4 py-3 text-[14px] text-red-deep">{error}</div>}
              <div ref={endRef} />
            </div>
            <div className="sticky bottom-0 bg-gradient-to-t from-white via-white to-white/0 px-4 pt-6 pb-5">
              <div className="mx-auto max-w-[760px]">{drop(true)}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Fil de conversation ----------

function DocumentBubble({ doc }: { doc: Document }) {
  const excerpt = doc.text.trim().slice(0, 280);
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-card px-4 py-3 text-ink">
        <p className="flex items-center gap-2 text-[15px] font-medium">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-red">
            <path d="M7 3h7l5 5v13H7z M14 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
          <span className="break-all">{doc.name}</span>
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-muted">
          {excerpt}
          {doc.text.length > excerpt.length && "…"}
        </p>
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center" aria-hidden="true">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" fill="#ff2e2e" />
        <path d="m8.5 12 2.5 2.5 4.5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function AssistantTyping({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-center gap-3">
      <AssistantAvatar />
      <span className="flex items-center gap-1.5 text-[14px] text-body">
        {label}
        <span className="size-1.5 rounded-full bg-red fl-pulse" />
      </span>
    </div>
  );
}

function CadrageSummary({ answers, mode, model }: { answers: Record<string, string>; mode: Mode; model: ModelId }) {
  const values = Object.values(answers).filter(Boolean);
  return (
    <div className="mt-6 flex gap-3">
      <AssistantAvatar />
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-1">
        <span className="fl-badge bg-red/10 text-red-deep">{MODE_LABEL[mode] ?? mode}</span>
        <span className="fl-badge bg-card text-body">{MODEL_CHOICES.find((c) => c.id === model)?.label ?? model}</span>
        {values.map((v) => (
          <span key={v} className="fl-badge bg-card text-body">
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function WorkBlock({ events, running }: { events: AgentEvent[]; running: boolean }) {
  return (
    <div className="mt-6 flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <AnimatePresence initial={false}>
          {running && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="flex flex-col items-center rounded-[20px] bg-warm px-4 pt-6 pb-5">
              <AgentWork events={events} />
            </motion.div>
          )}
        </AnimatePresence>

        <Disclosure
          className="mt-3 px-4 py-3"
          title={
            <>
              <FolderIcon open={running} size={18} />
              {running ? "Travail des agents en direct" : "Travail des agents"} · {events.length} étape{events.length > 1 ? "s" : ""}
            </>
          }
        >
          <ol className="mt-3 flex max-h-[360px] flex-col gap-2.5 overflow-y-auto pr-1">
            {events.map((event) => {
              const style = AGENT_STYLE[event.agent] ?? AGENT_STYLE.orchestrateur;
              return (
                <li key={event.id} className="flex gap-2.5">
                  <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-red/70" />
                  <div className="min-w-0">
                    <span className="text-[12px] font-medium">{style.label}</span>
                    <span className="fl-mono ml-2 text-[11px] text-muted">{new Date(event.ts).toLocaleTimeString("fr-FR")}</span>
                    <p className={`text-[13px] leading-snug break-words ${event.type === "outil" ? "fl-mono text-[12px] text-muted" : event.type === "rejet" || event.type === "erreur" ? "text-red-deep" : "text-body"}`}>
                      {event.message}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Disclosure>
      </div>
    </div>
  );
}

/** Bloc repliable : le contenu se déplie en hauteur au lieu d'apparaître d'un coup. */
function Disclosure({ title, className = "", children }: { title: React.ReactNode; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-[14px] border border-line ${className}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-[13px] font-medium text-body hover:text-ink">
        <motion.svg animate={{ rotate: open ? 90 : 0 }} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-muted">
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </motion.svg>
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ORDER: Verdict[] = ["conflit", "incompetence", "forme", "vide", "doublon", "existant", "conforme"];

function Results({ analysis, findings }: { analysis: Analysis | null; findings: Finding[] }) {
  if (!analysis) return null;
  if (analysis.status === "erreur") {
    return <div className="mt-6 ml-11 rounded-[14px] border border-red/30 bg-red/5 p-5 text-[14px] text-red-deep">L’analyse a échoué. Le détail est dans le travail des agents ci-dessus.</div>;
  }
  const exploration = analysis.mode === "exploration";
  const sorted = [...findings].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const main = sorted.filter((f) => f.verdict !== "conforme" && !f.rejection_reason);
  const others = sorted.filter((f) => !main.includes(f));
  const summary = analysis.summary;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        {summary && (
          <div>
            <p className="text-[17px] leading-relaxed text-ink">{summary.headline}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {ORDER.filter((v) => summary.counts?.[v]).map((v, i) => (
                <motion.span
                  key={v}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 400, damping: 18 }}
                  className={`fl-badge ${VERDICT_STYLE[v].className}`}
                >
                  {summary.counts[v]} {VERDICT_STYLE[v].label.toLowerCase()}
                </motion.span>
              ))}
              {summary.rejected > 0 && <span className="fl-badge bg-card text-body">{summary.rejected} écartée(s) par le contradicteur</span>}
              <span className="fl-badge bg-card text-body">{summary.articles_consulted ?? "—"} articles consultés</span>
              {analysis.latency_ms != null && <span className="fl-badge bg-card text-body">{Math.round(analysis.latency_ms / 1000)} s</span>}
              {analysis.cost_usd != null && <span className="fl-badge bg-card text-body">{Number(analysis.cost_usd).toFixed(2)} $</span>}
            </div>
          </div>
        )}

        {exploration && main.length > 0 && <p className="mt-6 fl-eyebrow">Ce qui existe déjà</p>}
        {main.length === 0 && (
          <div className="mt-5 rounded-[14px] bg-warm p-5 text-[14px] text-body">
            {exploration ? "Aucun texte pertinent trouvé dans le corpus consulté." : "Aucune alerte retenue : le texte paraît conforme au droit en vigueur consulté."}
          </div>
        )}
        <div className="mt-4 flex flex-col gap-4">
          {main.map((f, i) => (
            <FindingCard key={f.id} finding={f} index={i} />
          ))}
        </div>

        {others.length > 0 && (
          <Disclosure className="mt-4 p-4" title={`${others.length} élément(s) conforme(s) ou écarté(s)`}>
            <div className="mt-3 flex flex-col gap-3">
              {others.map((f) => (
                <FindingCard key={f.id} finding={f} compact />
              ))}
            </div>
          </Disclosure>
        )}
      </div>
    </motion.div>
  );
}

function FindingCard({ finding, compact = false, index = 0 }: { finding: Finding; compact?: boolean; index?: number }) {
  const openSource = useContext(OpenSource);
  const [feedback, setFeedback] = useState<"valide" | "rejete" | null>(null);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const verdict = VERDICT_STYLE[finding.verdict] ?? VERDICT_STYLE.conforme;
  const informative = finding.verdict === "existant" || finding.verdict === "conforme";

  async function send(decision: "valide" | "rejete") {
    setSending(true);
    setFeedbackError(false);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ finding_id: finding.id, decision, reason: decision === "rejete" ? reason.trim() || undefined : undefined }),
      });
      if (!res.ok) throw new Error();
      setFeedback(decision);
      setAsking(false);
    } catch {
      setFeedbackError(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: feedback === "rejete" ? 0.62 : 1, y: 0, scale: 1, x: 0 }}
      transition={{ delay: compact ? 0 : 0.2 + index * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[16px] border bg-white ${compact ? "p-4" : "p-5 shadow-[var(--shadow-sm)]"} ${
        feedback === "valide" ? "border-red/40" : "border-line"
      }`}
    >
      {!informative && !compact && (
        <motion.span
          aria-hidden="true"
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.35 + index * 0.09, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="absolute top-0 bottom-0 left-0 w-[3px] origin-top bg-gradient-to-b from-[#ff2e2e] to-[#ff7a2e]"
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`fl-badge ${verdict.className}`}>{verdict.label}</span>
        {!informative && <span className="fl-badge bg-card text-body">{SEVERITY_LABEL[finding.severity]}</span>}
        {finding.verified && !finding.rejection_reason && <span className="fl-badge bg-red/10 text-red-deep">Citations vérifiées</span>}
        {finding.rejection_reason && <span className="fl-badge bg-card text-muted">Écartée</span>}
      </div>
      <h3 className={`mt-3 leading-snug tracking-[-0.02em] ${compact ? "text-[15px]" : "text-[18px]"} ${feedback === "rejete" ? "line-through decoration-red/50" : ""}`}>{finding.title}</h3>
      {finding.disposition?.text && finding.verdict !== "existant" && (
        <blockquote className="mt-2 border-l-2 border-line-2 pl-3 text-[13px] italic text-muted">{finding.disposition.text}</blockquote>
      )}
      <p className="mt-3 text-[14px] leading-relaxed text-body">{finding.explanation}</p>
      {finding.rejection_reason && <p className="mt-3 rounded-[10px] bg-card px-3 py-2 text-[13px] text-body">Motif du rejet : {finding.rejection_reason}</p>}

      {finding.citations.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {finding.citations.map((c, ci) => (
            <motion.button
              type="button"
              key={`${c.article_id}-${c.quote.slice(0, 20)}`}
              onClick={() => openSource({ articleId: c.article_id, quote: c.quote })}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: (compact ? 0 : 0.4 + index * 0.09) + ci * 0.06 }}
              whileHover={{ x: 3 }}
              className="group block w-full rounded-[10px] border border-line bg-warm px-3.5 py-2.5 text-left transition-colors hover:border-red/30 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <FolderIcon size={16} />
                  Art. {c.num.replace(/^art\.?\s*/i, "")} · <span className="text-body">{c.code}</span>
                </span>
                <span className="fl-mono shrink-0 text-[11px] text-muted group-hover:text-red">Voir la source →</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-body">« {c.quote} »</p>
            </motion.button>
          ))}
        </div>
      )}

      {finding.suggestion && !compact && <Suggestion text={finding.suggestion} label={informative ? "À retenir" : "Rédaction proposée"} delay={0.55 + index * 0.09} />}

      {!compact && (
        <div className="mt-4 border-t border-line pt-3">
          <AnimatePresence mode="wait" initial={false}>
            {feedback ? (
              <motion.div key="merci" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5 text-[13px] text-body">
                {feedback === "valide" ? <FiledFolder /> : <BrickMascot size={18} idle />}
                {feedback === "valide" ? "Rangé dans la doctrine interne." : "Faux positif enregistré : les agents en tiendront compte."}
              </motion.div>
            ) : asking ? (
              <motion.form
                key="motif"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  void send("rejete");
                }}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Pourquoi est-ce un faux positif ? (facultatif)"
                  className="h-9 min-w-[220px] flex-1 rounded-full border border-line-2 px-4 text-[13px] outline-none focus:border-red/40"
                />
                <button type="submit" disabled={sending} className="fl-btn fl-btn--red fl-btn--sm">
                  {sending ? "Envoi…" : "Envoyer"}
                </button>
                <button type="button" onClick={() => setAsking(false)} className="text-[13px] text-muted hover:text-ink">
                  Annuler
                </button>
              </motion.form>
            ) : (
              <motion.div key="choix" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -4 }} className="flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[13px] text-muted">{informative ? "Utile ?" : "Cette alerte est-elle juste ?"}</span>
                <motion.button whileTap={{ scale: 0.92 }} type="button" disabled={sending} onClick={() => send("valide")} className="fl-btn fl-btn--ghost fl-btn--sm hover:border-red/40 hover:text-red-deep">
                  ✓ Pertinent
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  disabled={sending}
                  onClick={() => setAsking(true)}
                  className="fl-btn fl-btn--ghost fl-btn--sm hover:border-red/40 hover:text-red-deep"
                >
                  ✗ Faux positif
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
          {feedbackError && <p className="mt-2 text-[13px] text-red-deep">Envoi impossible, réessayez.</p>}
        </div>
      )}
    </motion.article>
  );
}

/** Rédaction proposée : le cadre se déplie, puis le texte s'écrit mot à mot. */
function Suggestion({ text, label, delay }: { text: string; label: string; delay: number }) {
  const words = text.split(/(\s+)/);
  const step = Math.min(0.03, 1.4 / words.length);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="mt-4 rounded-[12px] border border-red/20 bg-gradient-to-br from-[#fff4f1] to-white px-3.5 py-3"
    >
      <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.04em] text-red-deep">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 20h4L19 9l-4-4L4 16v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        {label}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-ink">
        {words.map((w, i) => (
          <motion.span key={i} initial={{ opacity: 0, filter: "blur(3px)" }} animate={{ opacity: 1, filter: "blur(0px)" }} transition={{ delay: delay + 0.2 + i * step, duration: 0.25 }}>
            {w}
          </motion.span>
        ))}
      </p>
    </motion.div>
  );
}

/** « Pertinent » : la feuille ressort du dossier rouge puis y rentre, et le dossier se ferme. */
function FiledFolder() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setOpen(false), 450);
    return () => clearTimeout(timer);
  }, []);
  return (
    <motion.span initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14 }} className="inline-flex">
      <FolderIcon open={open} size={22} />
    </motion.span>
  );
}

// ---------- Conversations ----------

const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
function relative(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

function ConversationList(props: {
  items: ConversationItem[] | null;
  activeId: string | null;
  open: boolean;
  onClose: () => void;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  const { items, activeId, open, onClose, onNew, onOpen } = props;
  const list = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="fl-eyebrow">Conversations</span>
        <button type="button" onClick={onClose} className="text-[13px] text-muted hover:text-ink lg:hidden" aria-label="Fermer">
          Fermer
        </button>
      </div>
      <button type="button" onClick={onNew} className="mx-2 mb-2 flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[14px] font-medium text-ink transition-colors hover:bg-card">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Nouvelle conversation
      </button>
      <nav className="flex-1 overflow-y-auto px-2 pb-6" aria-label="Conversations passées">
        {items === null && <p className="px-3 py-2 text-[13px] text-muted">Chargement…</p>}
        {items?.length === 0 && <p className="px-3 py-2 text-[13px] text-muted">Aucune conversation pour l’instant.</p>}
        {items?.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className={`block w-full rounded-[10px] px-3 py-2.5 text-left transition-colors ${c.id === activeId ? "bg-card" : "hover:bg-warm"}`}
          >
            <span className="line-clamp-2 text-[13.5px] leading-snug text-ink">{c.title}</span>
            <span className="mt-1 flex items-center gap-1.5 text-[11.5px] text-muted">
              <span className={`size-1.5 rounded-full ${c.status === "termine" ? "bg-ok" : c.status === "erreur" ? "bg-red" : "bg-orange fl-pulse"}`} />
              {c.mode ? MODE_LABEL[c.mode] : "Contrôle"} · {relative(c.created_at)}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );

  return (
    <>
      <aside className="sticky top-16 hidden h-[calc(100dvh-64px)] w-[264px] shrink-0 border-r border-line bg-warm/60 lg:block">{list}</aside>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white shadow-[var(--shadow-lg)] lg:hidden"
            >
              {list}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
