"use client";

// La zone de prompt : grande boîte arrondie, « + » pour joindre un texte, « Outils »
// pour le modèle et le mode, micro (bientôt), bouton envoyer rouge dès qu'il y a du texte.
import { useEffect, useRef, useState } from "react";
import { MODEL_CHOICES, type Mode, type ModelId } from "@/lib/types";

export const MODE_LABEL: Record<Mode, string> = {
  controle: "Contrôler un texte",
  exploration: "Explorer une idée",
};

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  model: ModelId;
  onModel: (model: ModelId) => void;
  mode: Mode | null; // null = laisser l'IA proposer
  onMode: (mode: Mode | null) => void;
  attachment: string;
  onAttachment: (text: string) => void;
  onExample: () => void;
  autoFocus?: boolean;
}

function useClickOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function ChatComposer(props: Props) {
  const { value, onChange, onSubmit, disabled, model, onModel, mode, onMode, attachment, onAttachment, onExample, autoFocus } = props;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [panel, setPanel] = useState<"joindre" | "outils" | null>(null);
  const closePanel = () => setPanel(null);
  const panelRef = useClickOutside(panel !== null, closePanel);
  const canSend = !disabled && value.trim().length > 0;
  const modelLabel = MODEL_CHOICES.find((m) => m.id === model)?.label ?? model;

  // Hauteur automatique du champ.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && !disabled) textarea.current?.focus();
  }, [autoFocus, disabled]);

  async function readFile(file: File) {
    onAttachment((await file.text()).slice(0, 60_000));
    setPanel(null);
  }

  return (
    <div ref={panelRef} className="relative w-full">
      {attachment && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
          <span className="fl-badge bg-card text-body">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M7 3h7l5 5v13H7z M14 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
            Texte joint ({attachment.length.toLocaleString("fr-FR")} caractères)
            <button type="button" aria-label="Retirer le texte joint" className="ml-1 text-muted hover:text-ink" onClick={() => onAttachment("")}>
              ×
            </button>
          </span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) onSubmit();
        }}
        className="rounded-[28px] border border-line-2 bg-white px-5 pt-4 pb-3 shadow-[0_10px_30px_#00000010,0_2px_8px_#0000000a] transition-shadow focus-within:shadow-[0_14px_40px_#00000018,0_2px_8px_#0000000d]"
      >
        <label htmlFor="lg-prompt" className="sr-only">
          Votre demande
        </label>
        <textarea
          id="lg-prompt"
          ref={textarea}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSubmit();
            }
          }}
          placeholder="Message…"
          className="block max-h-[240px] min-h-[28px] w-full resize-none bg-transparent text-[16px] leading-[1.5] text-ink outline-none placeholder:text-muted disabled:opacity-60"
        />

        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Joindre un texte"
            aria-expanded={panel === "joindre"}
            onClick={() => setPanel(panel === "joindre" ? null : "joindre")}
            className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-red"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-expanded={panel === "outils"}
            onClick={() => setPanel(panel === "outils" ? null : "outils")}
            className="flex h-9 items-center gap-2 rounded-full px-3 text-[14px] text-ink transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-red"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h9M17 7h3M4 17h3M11 17h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="15" cy="7" r="2" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="9" cy="17" r="2" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Outils
          </button>
          <span className="ml-1 hidden truncate rounded-full bg-card px-2.5 py-1 text-[12px] text-body sm:inline">{modelLabel}</span>
          {mode && <span className="hidden truncate rounded-full bg-red/10 px-2.5 py-1 text-[12px] text-red-deep md:inline">{MODE_LABEL[mode]}</span>}

          <div className="flex-1" />

          <button
            type="button"
            title="Dictée bientôt disponible"
            aria-label="Dictée vocale (bientôt disponible)"
            className="grid size-9 place-items-center rounded-full text-ink transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-red"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Envoyer"
            className={`grid size-11 place-items-center rounded-full text-white transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red ${
              canSend
                ? "bg-red shadow-[0_6px_18px_#ff2e2e52,inset_0_1.5px_#ffffff4d,inset_0_-2px_2px_#00000047] hover:-translate-y-px hover:bg-red-deep hover:shadow-[0_10px_26px_#ff2e2e6b,inset_0_1.5px_#ffffff4d,inset_0_-2px_2px_#00000047] active:translate-y-px"
                : "cursor-not-allowed bg-[#a3a3a8]"
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </form>

      {panel === "joindre" && (
        <div role="dialog" aria-label="Joindre un texte" className="absolute bottom-full left-0 z-30 mb-3 w-full max-w-[560px] rounded-[16px] border border-line bg-white p-4 shadow-[var(--shadow-lg)]">
          <p className="text-[14px] font-medium">Joindre le texte d’un acte</p>
          <p className="mt-1 text-[13px] text-muted">Collez un projet d’arrêté ou de délibération, ou importez un fichier .txt / .md.</p>
          <textarea
            value={attachment}
            onChange={(e) => onAttachment(e.target.value.slice(0, 60_000))}
            placeholder="Collez le texte ici…"
            className="fl-input mt-3 h-40 resize-y font-mono text-[12.5px] leading-relaxed"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="fl-btn fl-btn--ghost fl-btn--sm cursor-pointer">
              Importer un fichier
              <input type="file" accept=".txt,.md,text/plain,text/markdown" className="sr-only" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            </label>
            <button
              type="button"
              className="fl-btn fl-btn--ghost fl-btn--sm"
              onClick={() => {
                onExample();
                setPanel(null);
              }}
            >
              Charger un exemple
            </button>
            <div className="flex-1" />
            <button type="button" className="fl-btn fl-btn--sm" onClick={() => setPanel(null)}>
              OK
            </button>
          </div>
        </div>
      )}

      {panel === "outils" && (
        <div role="dialog" aria-label="Outils" className="absolute bottom-full left-0 z-30 mb-3 w-full max-w-[340px] rounded-[16px] border border-line bg-white p-2 shadow-[var(--shadow-lg)]">
          <p className="px-3 pt-2 pb-1 fl-eyebrow">Modèle</p>
          {MODEL_CHOICES.map((choice) => {
            const disabledChoice = "disabled" in choice && choice.disabled;
            const active = choice.id === model;
            return (
              <button
                key={choice.id}
                type="button"
                disabled={disabledChoice}
                onClick={() => onModel(choice.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] transition-colors ${active ? "bg-card" : "hover:bg-warm"} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span>
                  <span className="block font-medium">{choice.label}</span>
                  <span className="block text-[12px] text-muted">{choice.hint}</span>
                </span>
                {active && <span className="size-2 rounded-full bg-red" aria-label="sélectionné" />}
              </button>
            );
          })}
          <p className="mt-1 border-t border-line px-3 pt-3 pb-1 fl-eyebrow">Mode</p>
          {([null, "controle", "exploration"] as const).map((m) => (
            <button
              key={m ?? "auto"}
              type="button"
              onClick={() => onMode(m)}
              className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-[14px] transition-colors ${mode === m ? "bg-card" : "hover:bg-warm"}`}
            >
              <span>
                <span className="block font-medium">{m ? MODE_LABEL[m] : "Automatique"}</span>
                <span className="block text-[12px] text-muted">
                  {m === "controle" ? "Texte presque prêt : chercher les conflits" : m === "exploration" ? "Idée floue : voir ce qui existe déjà" : "L’IA propose le mode selon votre demande"}
                </span>
              </span>
              {mode === m && <span className="size-2 rounded-full bg-red" aria-label="sélectionné" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
