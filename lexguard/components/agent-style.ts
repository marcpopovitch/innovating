import type { AgentName, Severity, Verdict } from "@/lib/types";

export const AGENT_STYLE: Record<AgentName, { label: string; dot: string }> = {
  orchestrateur: { label: "Orchestrateur", dot: "bg-ink" },
  analyste: { label: "Analyste", dot: "bg-[#09f]" },
  chercheur: { label: "Chercheur", dot: "bg-[#7c5cff]" },
  juge: { label: "Juge", dot: "bg-red" },
  contradicteur: { label: "Contradicteur", dot: "bg-orange" },
  redacteur: { label: "Rédacteur", dot: "bg-ok" },
  veilleur: { label: "Veilleur", dot: "bg-[#09f]" },
  impact: { label: "Impact", dot: "bg-red" },
};

export const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  conflit: { label: "Conflit", className: "bg-red/10 text-red-deep" },
  incompetence: { label: "Incompétence", className: "bg-red/10 text-red-deep" },
  forme: { label: "Vice de forme", className: "bg-red/10 text-red-deep" },
  doublon: { label: "Doublon", className: "bg-orange/10 text-orange" },
  vide: { label: "Vide juridique", className: "bg-orange/10 text-orange" },
  conforme: { label: "Conforme", className: "bg-ok/10 text-ok" },
  existant: { label: "Texte existant", className: "bg-[#09f]/10 text-[#0077cc]" },
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  critique: "Critique",
  majeure: "Majeure",
  mineure: "Mineure",
  info: "Info",
};
