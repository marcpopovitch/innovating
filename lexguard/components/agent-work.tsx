"use client";

// Les agents au travail : le globe trace leurs recherches, les dossiers rouges s'ouvrent
// au fil des sources consultées, et chaque sous-agent a sa ligne avec une mascotte brique
// qui court tant qu'il cherche (inspiré du SubAgentStack de Zzz-web).
import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";
import { useI18n } from "@/components/lang-provider";
import { AGENT_STYLE, agentLabel } from "@/components/agent-style";
import { SOURCES, sourcesOf, type SourceId } from "@/components/agent-sources";
import { BrickMascot } from "@/components/brick-mascot";
import { LoadingGlobe } from "@/components/loading-globe";
import type { AgentEvent } from "@/lib/types";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Dossier façon macOS, en rouge ; `open` fait sortir la feuille. */
export function FolderIcon({ open = false, size = 28 }: { open?: boolean; size?: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill="none" aria-hidden="true" className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a7a" />
          <stop offset="1" stopColor="#e8303d" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="0.45" stopColor="#ff5d63" />
          <stop offset="1" stopColor="#f23a46" />
        </linearGradient>
      </defs>
      <path d="M42 200a66 66 0 0 1 66-66h206a66 66 0 0 1 52 26l22 28a50 50 0 0 0 40 20h446a66 66 0 0 1 66 66v560a66 66 0 0 1-66 66H108a66 66 0 0 1-66-66z" fill={`url(#${id}b)`} />
      <motion.g initial={false} animate={{ y: open ? -110 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
        <rect x="104" y="232" width="816" height="300" rx="30" fill="#fff" />
        <rect x="190" y="300" width="480" height="34" rx="17" fill="#ffd2d2" />
        <rect x="190" y="370" width="620" height="34" rx="17" fill="#ffe3e3" />
      </motion.g>
      <path d="M42 330a60 60 0 0 1 60-60h820a60 60 0 0 1 60 60v500a60 60 0 0 1-60 60H102a60 60 0 0 1-60-60z" fill={`url(#${id}f)`} />
      <path d="M102 270h820a60 60 0 0 1 60 60v40H42v-40a60 60 0 0 1 60-60z" fill="#fff" fillOpacity="0.28" />
    </svg>
  );
}

function SourceFolders({ events }: { events: AgentEvent[] }) {
  const { t } = useI18n();
  const counts = new Map<SourceId, number>();
  for (const e of events) for (const s of sourcesOf(e.message)) counts.set(s, (counts.get(s) ?? 0) + 1);
  const lastSources = events.length ? sourcesOf(events[events.length - 1].message) : [];
  return (
    <ul className="flex flex-wrap justify-center gap-2" aria-label={t("docs.sources.aria")}>
      {SOURCES.filter((s) => s.id !== "outremer" || counts.has("outremer")).map((s) => {
        const n = counts.get(s.id) ?? 0;
        const live = lastSources.includes(s.id);
        return (
          <motion.li
            key={s.id}
            layout
            animate={{ opacity: n ? 1 : 0.45, scale: live ? 1.06 : 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className={`flex items-center gap-2 rounded-full border bg-white py-1 pr-3 pl-1.5 text-[12.5px] ${live ? "border-red/40 text-ink" : "border-line text-body"}`}
          >
            <FolderIcon open={n > 0} size={22} />
            {t(s.labelKey)}
            {n > 0 && (
              <motion.span key={n} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fl-mono text-[11px] text-red">
                {n}
              </motion.span>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}

function AgentRows({ events }: { events: AgentEvent[] }) {
  const { t } = useI18n();
  // Une ligne par agent (ordre d'arrivée), avec son dernier message.
  const latest = new Map<AgentEvent["agent"], AgentEvent>();
  for (const e of events) if (e.type !== "fin") latest.set(e.agent, e);
  const rows = [...latest.values()];

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2.5 text-[14px] text-body">
        <BrickMascot size={20} />
        {t("docs.agents.starting")}
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5" aria-live="polite">
      <AnimatePresence initial={false}>
        {rows.map((e) => {
          const style = AGENT_STYLE[e.agent] ?? AGENT_STYLE.orchestrateur;
          const done = e.type === "resultat" || e.type === "rejet" || e.type === "erreur";
          return (
            <motion.li
              key={e.agent}
              layout
              initial={{ opacity: 0, height: 0, y: 6, filter: "blur(2px)" }}
              animate={{ opacity: 1, height: "auto", y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.38, ease: EASE }}
              className="flex items-center gap-2.5 rounded-[12px] bg-white px-3 py-2 text-[13px] shadow-[0_1px_2px_#0000000a]"
            >
              <BrickMascot size={18} idle={done} />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-red">{agentLabel(t, e.agent in AGENT_STYLE ? e.agent : "orchestrateur")}</span>
                <span className="text-muted"> · </span>
                <motion.span
                  key={e.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32 }}
                  className={e.type === "rejet" || e.type === "erreur" ? "text-red-deep" : "text-body"}
                >
                  {e.message}
                </motion.span>
              </span>
              {e.type === "resultat" && (
                <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-red">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              )}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}

export function AgentWork({ events }: { events: AgentEvent[] }) {
  return (
    <div className="flex w-full flex-col items-center">
      <LoadingGlobe events={events} className="w-[min(300px,66vw)]" />
      <div className="mt-4 w-full">
        <SourceFolders events={events} />
      </div>
      <div className="mt-4 w-full max-w-[560px]">
        <AgentRows events={events} />
      </div>
    </div>
  );
}
