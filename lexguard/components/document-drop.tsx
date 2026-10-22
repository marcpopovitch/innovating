"use client";

// Le cœur de l'outil : on dépose un document (ou un dossier) n'importe où sur la page, et c'est
// tout. PDF, Word, texte → chaque acte est contrôlé ; décisions du Conseil d'État → ajoutées à la
// base. Pas de champ de saisie ni de questions.
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ModelBadge, ModelIcon } from "@/components/model-icons";
import { MODEL_CHOICES, type Mode, type ModelId } from "@/lib/types";

export const MODE_LABEL: Record<Mode, string> = {
  controle: "Contrôler un texte",
  exploration: "Explorer une idée",
};

export interface Document {
  name: string;
  text: string;
}

interface Props {
  onDocuments: (docs: Document[]) => void;
  onExample: () => void;
  disabled?: boolean;
  model: ModelId;
  onModel: (model: ModelId) => void;
  /** Version réduite, en bas de la conversation. */
  compact?: boolean;
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

const ACCEPT = ".pdf,.docx,.txt,.md,.xml,.zip,.html,.htm";

export function DocumentDrop(props: Props) {
  const { onDocuments, onExample, disabled, model, onModel, compact } = props;
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const menuRef = useClickOutside(menu, closeMenu);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Le serveur reconnaît les fichiers : actes à contrôler, ou décisions du Conseil d'État
  // (ajoutées à la base que lisent les agents).
  const readFiles = useCallback(
    async (files: File[], label: string) => {
      setNotice(null);
      if (!files.length) return setNotice({ ok: false, text: `${label} : aucun fichier trouvé` });
      setImporting(true);
      try {
        const body = new FormData();
        for (const file of files) body.append("file", file);
        const res = await fetch("/api/fichier", { method: "POST", body });
        const data = await res.json().catch(() => ({ error: "Réponse illisible du serveur" }));
        if (!res.ok) return setNotice({ ok: false, text: `${label} : ${data.error ?? "fichier illisible"}` });
        if (data.total)
          setNotice({
            ok: true,
            text: `${data.total.toLocaleString("fr-FR")} décision${data.total > 1 ? "s" : ""} du Conseil d'État reconnue${data.total > 1 ? "s" : ""} — ${data.nouvelles ? `${data.nouvelles.toLocaleString("fr-FR")} ajoutée${data.nouvelles > 1 ? "s" : ""} à la base` : `déjà ${data.total > 1 ? "toutes " : ""}dans la base`}.`,
          });
        if (data.actes?.length) onDocuments(data.actes);
      } catch {
        setNotice({ ok: false, text: `${label} : envoi impossible` });
      } finally {
        setImporting(false);
      }
    },
    [onDocuments],
  );

  // Dépôt n'importe où sur la page. Un dossier arrive comme un faux fichier illisible : on le parcourt.
  useEffect(() => {
    if (disabled) return;
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    };
    const onLeave = (e: DragEvent) => {
      if (hasFiles(e) && --depth <= 0) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const entries = [...(e.dataTransfer?.items ?? [])].map((i) => i.webkitGetAsEntry()).filter((x) => x !== null);
      // Navigateur sans parcours de dossiers : on prend les fichiers tels quels.
      if (!entries.length) {
        const files = [...(e.dataTransfer?.files ?? [])];
        if (files.length) readFiles(files, files.length > 1 ? `${files.length} fichiers` : files[0].name);
        return;
      }
      Promise.all(entries.map(entryFiles))
        .then((lists) => readFiles(lists.flat(), entries.length > 1 ? `${entries.length} éléments` : entries[0].name))
        .catch(() => setNotice({ ok: false, text: `${entries[0].name} : lecture impossible` }));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [disabled, readFiles]);

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].filter((f) => !f.name.startsWith("."));
    if (files.length) readFiles(files, files.length > 1 ? `${files.length} fichiers` : files[0].name);
    e.target.value = "";
  };

  const buttons = (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "justify-center"}`}>
      <label className={`fl-btn fl-btn--sm ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
        Choisir des fichiers
        <input type="file" multiple accept={ACCEPT} disabled={disabled} className="sr-only" onChange={pick} />
      </label>
      <label className={`fl-btn fl-btn--ghost fl-btn--sm ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
        Choisir un dossier
        {/* webkitdirectory : attribut non typé par React, on le passe tel quel. */}
        <input type="file" disabled={disabled} className="sr-only" onChange={pick} {...{ webkitdirectory: "" }} />
      </label>
      {!compact && (
        <button type="button" disabled={disabled} onClick={onExample} className="fl-btn fl-btn--ghost fl-btn--sm">
          Essayer avec un exemple
        </button>
      )}
      <div ref={menuRef} className="relative">
        <ModelButton model={model} open={menu} onToggle={() => setMenu(!menu)} />
        <AnimatePresence>
          {menu && (
            <ModelMenu
              model={model}
              onPick={(id) => {
                onModel(id);
                setMenu(false);
              }}
              onClose={() => setMenu(false)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      {(importing || notice) && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 px-2">
          {importing && <span className="fl-badge bg-card text-muted">Lecture des documents…</span>}
          {notice && (
            <span className={`fl-badge ${notice.ok ? "bg-card text-body" : "bg-[#fff4f1] text-red-deep"}`}>
              {notice.text}
              <button type="button" aria-label="Fermer le message" className="ml-1 text-muted hover:text-ink" onClick={() => setNotice(null)}>
                ×
              </button>
            </span>
          )}
        </div>
      )}

      {compact ? (
        <div className="flex flex-wrap items-center gap-3 rounded-[28px] border border-dashed border-line-2 bg-white px-5 py-3 shadow-[0_10px_30px_#00000010,0_2px_8px_#0000000a]">
          <span className="text-[14px] text-body">{disabled ? "Analyse en cours…" : "Déposez un autre document ici"}</span>
          <div className="flex-1" />
          {buttons}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5 rounded-[28px] border-2 border-dashed border-line-2 bg-white px-6 py-12 text-center shadow-[0_10px_30px_#00000010,0_2px_8px_#0000000a]">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-red">
            <path d="M7 3h7l5 5v13H7z M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M13 17v-6m-3 3 3-3 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <p className="text-[17px] font-medium text-ink">Glissez un arrêté, une délibération ou un dossier entier</p>
            <p className="mt-1 text-[13.5px] text-muted">PDF, Word, texte — ou décisions du Conseil d’État (.zip / .xml) pour enrichir la base.</p>
          </div>
          {buttons}
        </div>
      )}

      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-3 z-50 grid place-items-center rounded-[28px] border-2 border-dashed border-red bg-[#fff4f1ee] text-[20px] font-medium text-ink"
          >
            Déposez vos documents
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Fichiers d'un élément déposé, dossiers parcourus récursivement (fichiers cachés ignorés). */
async function entryFiles(entry: FileSystemEntry): Promise<File[]> {
  if (entry.name.startsWith(".")) return [];
  if (entry.isFile) return [await new Promise<File>((ok, ko) => (entry as FileSystemFileEntry).file(ok, ko))];
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  const children: FileSystemEntry[] = [];
  // readEntries rend les éléments par paquets (100 dans Chrome) : on lit jusqu'à un paquet vide.
  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((ok, ko) => reader.readEntries(ok, ko));
    if (!batch.length) break;
    children.push(...batch);
  }
  return (await Promise.all(children.map(entryFiles))).flat();
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
    <motion.div
      ref={rootRef}
      initial={{ opacity: 0, y: place.up ? 8 : -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: place.up ? 6 : -6, scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      style={{ maxHeight: place.max }}
      className={`absolute right-0 z-30 flex w-[min(380px,calc(100vw-32px))] flex-col rounded-[18px] border border-line bg-white p-2 shadow-[var(--shadow-lg)] ${place.up ? "bottom-full mb-3" : "top-full mt-3"}`}
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
    </motion.div>
  );
}
