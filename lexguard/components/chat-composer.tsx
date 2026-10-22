"use client";

// La zone de prompt : grande boîte arrondie, « + » pour joindre un texte, sélecteur de
// modèle (logos en dégradé rouge), micro (bientôt), bouton envoyer rouge dès qu'il y a du texte.
// Le mode (contrôle / exploration) se choisit ensuite, dans le message de cadrage.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ModelBadge, ModelIcon } from "@/components/model-icons";
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
  const { value, onChange, onSubmit, disabled, model, onModel, attachment, onAttachment, onExample, autoFocus } = props;
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [panel, setPanel] = useState<"joindre" | "modele" | null>(null);
  const closePanel = useCallback(() => setPanel(null), []);
  const panelRef = useClickOutside(panel !== null, closePanel);
  const canSend = !disabled && value.trim().length > 0;

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
          <ModelButton model={model} open={panel === "modele"} onToggle={() => setPanel(panel === "modele" ? null : "modele")} />

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

      {panel === "modele" && (
        <ModelMenu
          model={model}
          onPick={(id) => {
            onModel(id);
            setPanel(null);
            textarea.current?.focus();
          }}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}

const fmtPrice = (n: number) => n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ModelButton({ model, open, onToggle }: { model: ModelId; open: boolean; onToggle: () => void }) {
  const choice = MODEL_CHOICES.find((m) => m.id === model) ?? MODEL_CHOICES[0];
  return (
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-label={`Modèle : ${choice.label}`}
      onClick={onToggle}
      className={`flex h-9 max-w-[220px] items-center gap-2 rounded-full border px-3 text-[14px] text-ink transition-colors focus-visible:outline-2 focus-visible:outline-red ${
        open ? "border-[#ff2e2e40] bg-[#fff4f1]" : "border-line hover:bg-card"
      }`}
    >
      <ModelIcon provider={choice.provider} size={16} />
      <span className="truncate">{choice.label}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}>
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function ModelMenu({ model, onPick, onClose }: { model: ModelId; onPick: (id: ModelId) => void; onClose: () => void }) {
  const listRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(() => Math.max(0, MODEL_CHOICES.findIndex((m) => m.id === model)));
  // Le menu s'ouvre du côté où il y a le plus de place et se limite à cet espace (la liste défile).
  const [place, setPlace] = useState<{ up: boolean; max: number }>({ up: true, max: 420 });

  useLayoutEffect(() => {
    const anchor = rootRef.current?.parentElement;
    if (!anchor) return;
    const compute = () => {
      const r = anchor.getBoundingClientRect();
      const above = r.top - 80; // laisse la place de l'en-tête
      const below = window.innerHeight - r.bottom - 16;
      const up = above >= Math.min(420, below) || above >= below;
      setPlace({ up, max: Math.max(180, Math.floor((up ? above : below) - 12)) });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  useEffect(() => {
    listRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    document.getElementById(`model-opt-${MODEL_CHOICES[active].id}`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div
      ref={rootRef}
      style={{ maxHeight: place.max }}
      className={`absolute left-0 z-30 flex w-full max-w-[380px] flex-col rounded-[18px] border border-line bg-white p-2 shadow-[var(--shadow-lg)] ${place.up ? "bottom-full mb-3" : "top-full mt-3"}`}
    >
      <p className="shrink-0 px-3 pt-2 pb-2 fl-eyebrow">Modèle de jugement</p>
      <ul
        ref={listRef}
        role="listbox"
        tabIndex={-1}
        aria-label="Choisir un modèle"
        aria-activedescendant={`model-opt-${MODEL_CHOICES[active].id}`}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % MODEL_CHOICES.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i - 1 + MODEL_CHOICES.length) % MODEL_CHOICES.length);
          } else if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPick(MODEL_CHOICES[active].id);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain outline-none"
      >
        {MODEL_CHOICES.map((choice, i) => {
          const selected = choice.id === model;
          return (
            <li
              key={choice.id}
              id={`model-opt-${choice.id}`}
              role="option"
              aria-selected={selected}
              onMouseEnter={() => setActive(i)}
              onClick={() => onPick(choice.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-[12px] px-3 py-2.5 transition-colors ${i === active ? "bg-warm" : ""}`}
            >
              <ModelBadge provider={choice.provider} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                  {choice.label}
                  {i === 0 && <span className="rounded-full bg-gradient-to-r from-[#ff2e2e] to-[#ff7a2e] px-2 py-0.5 text-[10.5px] font-semibold text-white">Recommandé</span>}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {choice.hint.replace(/^Recommandé · /, "")} · {fmtPrice(choice.price[0])} $ / {fmtPrice(choice.price[1])} $ par M tokens
                </span>
              </span>
              {selected && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-red">
                  <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-1 shrink-0 border-t border-line px-3 pt-2.5 pb-1.5 text-[11.5px] leading-snug text-muted">
        Les recherches tournent toujours sur Claude Haiku 5.5 ; ce modèle rend le jugement final.
      </p>
    </div>
  );
}
