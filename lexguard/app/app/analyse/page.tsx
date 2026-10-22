"use client";

// Espace Analyse : une zone de prompt façon chat. L'IA cadre d'abord la demande
// (questions), puis les agents travaillent (globe animé), puis les résultats s'affichent.
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AGENT_STYLE, SEVERITY_LABEL, VERDICT_STYLE } from "@/components/agent-style";
import { ChatComposer, MODE_LABEL } from "@/components/chat-composer";
import { LoadingGlobe } from "@/components/loading-globe";
import { MODEL_CHOICES, type AgentEvent, type Analysis, type CadrageQuestion, type CadrageResponse, type Finding, type Mode, type ModelId, type Verdict } from "@/lib/types";

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

const SUGGESTIONS = [
  { label: "Vérifier un arrêté anti-pesticides", prompt: "Vérifie que mon projet d'arrêté ne contredit pas le droit en vigueur.", example: true },
  { label: "Ce qui existe sur la vidéoprotection", prompt: "Je réfléchis à installer de la vidéoprotection dans ma commune : qu'est-ce qui existe déjà comme textes ?", example: false },
  { label: "Encadrer les trottinettes en libre-service", prompt: "Quelles règles existent déjà pour encadrer les trottinettes électriques en libre-service dans une commune ?", example: false },
];

// Questions par défaut si le cadrage par l'IA est indisponible.
function fallbackCadrage(prompt: string, hasText: boolean): CadrageResponse {
  const controle = hasText || /article\s+\d|arr[êe]te\s*:|délibère/i.test(prompt);
  return {
    mode: controle ? "controle" : "exploration",
    title: prompt.slice(0, 70),
    reformulation: controle ? "Vous voulez vérifier qu'un texte presque prêt ne contredit pas le droit existant." : "Vous voulez savoir ce qui existe déjà avant de rédiger.",
    questions: [
      { id: "domaine", question: "Quel domaine ?", options: ["Police municipale", "Urbanisme", "Environnement", "Santé publique", "Circulation"], allow_free: true, default: null },
      { id: "periode", question: "Quelle période ?", options: ["Droit en vigueur aujourd'hui", "5 dernières années", "Depuis 2020"], allow_free: true, default: "Droit en vigueur aujourd'hui" },
      { id: "perimetre", question: "Quel périmètre ?", options: ["France", "France + Union européenne", "Ma collectivité"], allow_free: true, default: "France" },
    ],
  };
}

type Phase = "vide" | "cadrage-chargement" | "cadrage" | "lancement" | "analyse" | "termine";

interface ConversationItem {
  id: string;
  title: string;
  mode?: Mode;
  status: Analysis["status"];
  created_at: string;
}

export default function AnalysePage() {
  return (
    <Suspense>
      <ChatView />
    </Suspense>
  );
}

function ChatView() {
  const initialId = useSearchParams().get("id");
  const [prompt, setPrompt] = useState("");
  const [sentPrompt, setSentPrompt] = useState("");
  const [attachment, setAttachment] = useState("");
  const [sentAttachment, setSentAttachment] = useState("");
  const [model, setModel] = useState<ModelId>("claude-haiku-5-5");
  const [mode, setMode] = useState<Mode>("controle");
  const [cadrage, setCadrage] = useState<CadrageResponse | null>(null);
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
      setCadrage(null);
      setAnalysisId(id);
      setPhase("analyse");
      setDrawer(false);
      window.history.replaceState(null, "", `/app/analyse?id=${id}`);
      const a = await loadResult(id);
      if (!a) return;
      setSentPrompt(a.input);
      setSentAttachment("");
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
  }, [phase, cadrage, findings.length]);

  function newConversation() {
    sourceRef.current?.close();
    setPrompt("");
    setAttachment("");
    setSentPrompt("");
    setSentAttachment("");
    setCadrage(null);
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

  // 1. Envoi du prompt → cadrage (questions avant de lancer les agents).
  async function send() {
    const text = prompt.trim();
    if (!text) return;
    sourceRef.current?.close();
    setError(null);
    setSentPrompt(text);
    setSentAttachment(attachment);
    setPrompt("");
    setAttachment("");
    setAnalysis(null);
    setFindings([]);
    setEvents([]);
    setAnalysisId(null);
    setPhase("cadrage-chargement");
    window.history.replaceState(null, "", "/app/analyse");
    let result: CadrageResponse;
    try {
      const res = await fetch("/api/cadrage", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: attachment ? `${text}\n\n--- Texte joint ---\n${attachment.slice(0, 8000)}` : text }),
      });
      if (!res.ok) throw new Error();
      result = (await res.json()) as CadrageResponse;
    } catch {
      result = fallbackCadrage(text, attachment.length > 0);
    }
    setCadrage(result);
    setMode(result.mode);
    setAnswers(Object.fromEntries(result.questions.filter((q) => q.default).map((q) => [q.id, q.default as string])));
    setPhase("cadrage");
  }

  // 2. Lancement des agents avec les réponses de cadrage.
  async function launch(useDefaults = false) {
    if (!cadrage) return;
    setPhase("lancement");
    setError(null);
    const cadrageAnswers = useDefaults ? Object.fromEntries(cadrage.questions.filter((q) => q.default).map((q) => [q.id, q.default as string])) : answers;
    if (useDefaults) setAnswers(cadrageAnswers);
    const input = sentAttachment ? `${sentPrompt}\n\n--- Texte joint ---\n${sentAttachment}` : sentPrompt;
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: (cadrage.title || sentPrompt).slice(0, 300), input, mode, model, cadrage: cadrageAnswers, collectivite: null, date_acte: null }),
      });
      if (res.status === 503) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Aucune clé de modèle côté serveur : ajoutez OPENROUTER_API_KEY (ou ANTHROPIC_API_KEY) dans lexguard/.env puis relancez le serveur.");
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `réponse ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      setAnalysisId(id);
      setPhase("analyse");
      window.history.replaceState(null, "", `/app/analyse?id=${id}`);
      follow(id);
      void loadConversations();
    } catch (e) {
      setPhase("cadrage");
      setError(e instanceof Error ? e.message : "Les agents n'ont pas pu démarrer.");
    }
  }

  const busy = phase === "cadrage-chargement" || phase === "lancement" || phase === "analyse";
  const empty = phase === "vide";

  const composer = (
    <ChatComposer
      value={prompt}
      onChange={setPrompt}
      onSubmit={send}
      disabled={busy}
      model={model}
      onModel={setModel}
      attachment={attachment}
      onAttachment={setAttachment}
      onExample={() => {
        setAttachment(EXAMPLE);
        if (!prompt.trim()) setPrompt("Vérifie que mon projet d'arrêté ne contredit pas le droit en vigueur.");
      }}
      autoFocus
    />
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
              Comment puis-je vous aider ?
            </motion.h1>
            <p className="mt-3 max-w-[52ch] text-center text-[15px] text-body">
              Contrôlez un projet d’acte contre tout le droit en vigueur, ou explorez ce qui existe déjà avant de rédiger.
            </p>
            <div className="mt-10 w-full max-w-[760px]">{composer}</div>
            <div className="mt-5 flex max-w-[760px] flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setPrompt(s.prompt);
                    if (s.example) setAttachment(EXAMPLE);
                  }}
                  className="rounded-full border border-line-2 bg-white px-4 py-2 text-[13px] text-body transition-colors hover:border-ink/20 hover:text-ink"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="mx-auto w-full max-w-[760px] flex-1 px-4 pt-8 pb-10">
              <UserBubble text={sentPrompt} attachment={sentAttachment} />

              {phase === "cadrage-chargement" && <AssistantTyping label="Je cadre votre demande…" />}

              {cadrage && (phase === "cadrage" || phase === "lancement") && (
                <CadrageMessage
                  cadrage={cadrage}
                  answers={answers}
                  onAnswer={(id, value) => setAnswers((prev) => ({ ...prev, [id]: value }))}
                  mode={mode}
                  onMode={setMode}
                  model={model}
                  launching={phase === "lancement"}
                  onLaunch={() => launch(false)}
                  onSkip={() => launch(true)}
                />
              )}

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
              <div className="mx-auto max-w-[760px]">{composer}</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Fil de conversation ----------

function UserBubble({ text, attachment }: { text: string; attachment: string }) {
  const long = text.length > 600;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[20px] rounded-br-[6px] bg-card px-4 py-3 text-[15px] leading-relaxed text-ink">
        <p className="whitespace-pre-wrap break-words">{long ? `${text.slice(0, 600)}…` : text}</p>
        {attachment && <p className="mt-2 text-[12px] text-muted">+ texte joint ({attachment.length.toLocaleString("fr-FR")} caractères)</p>}
      </div>
    </div>
  );
}

function AssistantAvatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-white" aria-hidden="true">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
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

function CadrageMessage(props: {
  cadrage: CadrageResponse;
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  model: ModelId;
  launching: boolean;
  onLaunch: () => void;
  onSkip: () => void;
}) {
  const { cadrage, answers, onAnswer, mode, onMode, model, launching, onLaunch, onSkip } = props;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-relaxed text-ink">{cadrage.reformulation}</p>
        <p className="mt-1 text-[14px] text-body">Avant de lancer les agents, quelques précisions (facultatives) pour cibler la recherche :</p>

        <div className="mt-4 inline-flex rounded-full border border-line-2 bg-warm p-1" role="radiogroup" aria-label="Type d'analyse">
          {(["controle", "exploration"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => onMode(m)}
              className={`rounded-full px-4 py-1.5 text-[13px] transition-colors ${mode === m ? "bg-white font-medium text-ink shadow-[var(--shadow-sm)]" : "text-body hover:text-ink"}`}
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {cadrage.questions.map((q) => (
            <Question key={q.id} q={q} value={answers[q.id] ?? ""} onChange={(v) => onAnswer(q.id, v)} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button type="button" disabled={launching} onClick={onLaunch} className="fl-btn fl-btn--red">
            {launching ? "Lancement…" : "Lancer l’analyse"}
            <span className="fl-btn__arrow" aria-hidden="true">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
          <button type="button" disabled={launching} onClick={onSkip} className="text-[14px] text-body underline-offset-4 hover:text-ink hover:underline">
            Passer
          </button>
          <span className="text-[12px] text-muted">{MODEL_CHOICES.find((c) => c.id === model)?.label}</span>
        </div>
      </div>
    </motion.div>
  );
}

function Question({ q, value, onChange }: { q: CadrageQuestion; value: string; onChange: (v: string) => void }) {
  const custom = value !== "" && !q.options.includes(value);
  return (
    <fieldset>
      <legend className="text-[14px] font-medium text-ink">{q.question}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {q.options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? "" : option)}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] transition-colors ${active ? "border-ink bg-ink text-white" : "border-line-2 bg-white text-body hover:border-ink/30 hover:text-ink"}`}
            >
              {option}
            </button>
          );
        })}
        {q.allow_free && (
          <input
            aria-label={`${q.question} (réponse libre)`}
            value={custom ? value : ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Autre…"
            className={`h-[34px] w-[150px] rounded-full border px-3.5 text-[13px] outline-none focus:border-ink/40 ${custom ? "border-ink" : "border-line-2"}`}
          />
        )}
      </div>
    </fieldset>
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
  const last = [...events].reverse().find((e) => e.type !== "outil") ?? events.at(-1);
  const lastStyle = last ? AGENT_STYLE[last.agent] ?? AGENT_STYLE.orchestrateur : null;
  return (
    <div className="mt-6 flex gap-3">
      <AssistantAvatar />
      <div className="min-w-0 flex-1">
        <AnimatePresence initial={false}>
          {running && (
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, height: 0 }} className="flex flex-col items-center rounded-[20px] bg-warm px-4 pt-6 pb-5">
              <LoadingGlobe className="w-[min(320px,70vw)]" />
              <div className="mt-4 flex min-h-[44px] max-w-full items-start gap-2 text-center" aria-live="polite">
                {lastStyle && <span className={`mt-[7px] size-2 shrink-0 rounded-full ${lastStyle.dot}`} />}
                <p className="text-[14px] leading-snug text-body">
                  {last ? (
                    <>
                      <span className="font-medium text-ink">{lastStyle?.label} · </span>
                      {last.message}
                    </>
                  ) : (
                    "Les agents se mettent au travail…"
                  )}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <details className="mt-3 rounded-[14px] border border-line px-4 py-3" open={!running && events.length > 0 && events.length < 8}>
          <summary className="cursor-pointer text-[13px] font-medium text-body">
            {running ? "Travail des agents en direct" : "Travail des agents"} · {events.length} étape{events.length > 1 ? "s" : ""}
          </summary>
          <ol className="mt-3 flex max-h-[360px] flex-col gap-2.5 overflow-y-auto pr-1">
            {events.map((event) => {
              const style = AGENT_STYLE[event.agent] ?? AGENT_STYLE.orchestrateur;
              return (
                <li key={event.id} className="flex gap-2.5">
                  <span className={`mt-[7px] size-1.5 shrink-0 rounded-full ${style.dot}`} />
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
        </details>
      </div>
    </div>
  );
}

const ORDER: Verdict[] = ["conflit", "incompetence", "vide", "doublon", "existant", "conforme"];

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
              {ORDER.map((v) =>
                summary.counts?.[v] ? (
                  <span key={v} className={`fl-badge ${VERDICT_STYLE[v].className}`}>
                    {summary.counts[v]} {VERDICT_STYLE[v].label.toLowerCase()}
                  </span>
                ) : null,
              )}
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
          {main.map((f) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>

        {others.length > 0 && (
          <details className="mt-4 rounded-[14px] border border-line p-4">
            <summary className="cursor-pointer text-[13px] font-medium text-body">{others.length} élément(s) conforme(s) ou écarté(s)</summary>
            <div className="mt-3 flex flex-col gap-3">
              {others.map((f) => (
                <FindingCard key={f.id} finding={f} compact />
              ))}
            </div>
          </details>
        )}
      </div>
    </motion.div>
  );
}

function FindingCard({ finding, compact = false }: { finding: Finding; compact?: boolean }) {
  const [feedback, setFeedback] = useState<"valide" | "rejete" | null>(null);
  const [sending, setSending] = useState(false);
  const [feedbackError, setFeedbackError] = useState(false);
  const verdict = VERDICT_STYLE[finding.verdict] ?? VERDICT_STYLE.conforme;
  const informative = finding.verdict === "existant" || finding.verdict === "conforme";

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
    <article className={`rounded-[16px] border border-line bg-white ${compact ? "p-4" : "p-5 shadow-[var(--shadow-sm)]"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`fl-badge ${verdict.className}`}>{verdict.label}</span>
        {!informative && <span className="fl-badge bg-card text-body">{SEVERITY_LABEL[finding.severity]}</span>}
        {finding.verified && !finding.rejection_reason && <span className="fl-badge bg-ok/10 text-ok">Citations vérifiées</span>}
        {finding.rejection_reason && <span className="fl-badge bg-card text-muted">Écartée</span>}
      </div>
      <h3 className={`mt-3 leading-snug tracking-[-0.02em] ${compact ? "text-[15px]" : "text-[18px]"}`}>{finding.title}</h3>
      {finding.disposition?.text && finding.verdict !== "existant" && (
        <blockquote className="mt-2 border-l-2 border-line-2 pl-3 text-[13px] italic text-muted">{finding.disposition.text}</blockquote>
      )}
      <p className="mt-3 text-[14px] leading-relaxed text-body">{finding.explanation}</p>
      {finding.rejection_reason && <p className="mt-3 rounded-[10px] bg-card px-3 py-2 text-[13px] text-body">Motif du rejet : {finding.rejection_reason}</p>}

      {finding.citations.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {finding.citations.map((c) => (
            <a
              key={`${c.article_id}-${c.quote.slice(0, 20)}`}
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-[10px] border border-line bg-warm px-3.5 py-2.5 transition-colors hover:border-line-2 hover:bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">
                  Art. {c.num} · <span className="text-body">{c.code}</span>
                </span>
                <span className="fl-mono shrink-0 text-[11px] text-muted group-hover:text-red">Légifrance ↗</span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-body">« {c.quote} »</p>
            </a>
          ))}
        </div>
      )}

      {finding.suggestion && !compact && (
        <div className="mt-4 rounded-[10px] border border-ok/25 bg-ok/5 px-3.5 py-2.5">
          <p className="text-[12px] font-medium uppercase tracking-[0.04em] text-ok">{informative ? "À retenir" : "Rédaction proposée"}</p>
          <p className="mt-1 text-[14px] leading-relaxed text-ink">{finding.suggestion}</p>
        </div>
      )}

      {!compact && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {feedback ? (
            <span className="text-[13px] text-body">{feedback === "valide" ? "Merci : ajouté à la doctrine interne." : "Merci : faux positif enregistré, les agents en tiendront compte."}</span>
          ) : (
            <>
              <span className="mr-1 text-[13px] text-muted">{informative ? "Utile ?" : "Cette alerte est-elle juste ?"}</span>
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
    </article>
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
