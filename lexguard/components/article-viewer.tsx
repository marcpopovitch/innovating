"use client";

// Panneau « source » : le vrai texte de l'article cité, l'extrait surligné, l'historique de
// ses versions datées et ce qui a changé d'une version à l'autre (différence mot à mot).
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/lang-provider";

interface Version {
  id: string;
  niveau: string;
  code_title: string;
  num: string | null;
  section: string | null;
  text: string;
  etat: string;
  date_debut: string | null;
  date_fin: string | null;
}
interface Link {
  id: string;
  type: string;
  sens: string;
  num: string | null;
  code_title: string | null;
}
interface Sheet {
  article: Version & { source_url: string };
  versions: Version[];
  links: Link[];
}

export interface ViewerTarget {
  articleId: string;
  quote?: string;
}

type TFn = ReturnType<typeof useI18n>["t"];

const fmtDate = (d: string | null, lang: string, t: TFn) =>
  d && !d.startsWith("2999")
    ? new Date(d).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : t("app.viewer.today");

/** Expression qui retrouve l'extrait malgré les espaces, retours à la ligne et apostrophes typographiques. */
function quoteRegex(quote: string) {
  const words = quote
    .replace(/[«»"]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) =>
      w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]"),
    );
  return words.length ? new RegExp(words.join("\\s+"), "i") : null;
}

/** Différence mot à mot (plus longue sous-séquence commune). */
type Chunk = { kind: "same" | "add" | "del"; text: string };
function wordDiff(before: string, after: string): Chunk[] {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  if (a.length * b.length > 4_000_000)
    return [
      { kind: "del", text: before },
      { kind: "add", text: after },
    ];
  const dp = Array.from(
    { length: a.length + 1 },
    () => new Uint16Array(b.length + 1),
  );
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      dp[i][j] =
        a[i] === b[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: Chunk[] = [];
  const push = (kind: Chunk["kind"], text: string) =>
    out.at(-1)?.kind === kind
      ? (out[out.length - 1].text += text)
      : out.push({ kind, text });
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      push("same", a[i++]);
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < a.length) push("del", a[i++]);
  while (j < b.length) push("add", b[j++]);
  return out;
}

type Tab = "texte" | "historique" | "changements" | "liens";

export function ArticleViewer({
  target,
  onClose,
}: {
  target: ViewerTarget | null;
  onClose: () => void;
}) {
  // Une clé par citation : chaque ouverture repart d'un panneau neuf.
  return (
    <AnimatePresence>
      {target && (
        <Panel
          key={`${target.articleId}|${target.quote ?? ""}`}
          target={target}
          onClose={onClose}
        />
      )}
    </AnimatePresence>
  );
}

function Panel({
  target,
  onClose,
}: {
  target: ViewerTarget;
  onClose: () => void;
}) {
  const { t, lang } = useI18n();
  const fmt = (d: string | null) => fmtDate(d, lang, t);
  const etatLabel = (e: string) => {
    const k = `app.viewer.etat.${e}`;
    const v = t(k);
    return v === k ? e : v;
  };
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("texte");
  const [selected, setSelected] = useState<string | null>(target.articleId);
  const markRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/articles/${encodeURIComponent(target.articleId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s: Sheet) => !cancelled && setSheet(s))
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Versions réellement entrées en vigueur, de la plus ancienne à la plus récente.
  const versions = useMemo(
    () => (sheet?.versions ?? []).filter((v) => v.etat !== "MODIFIE_MORT_NE"),
    [sheet],
  );
  const current =
    versions.find((v) => v.id === selected) ?? sheet?.article ?? null;
  const index = current ? versions.findIndex((v) => v.id === current.id) : -1;
  const previous = index > 0 ? versions[index - 1] : null;
  const diff = useMemo(
    () => (current && previous ? wordDiff(previous.text, current.text) : null),
    [current, previous],
  );
  const words = (kind: Chunk["kind"]) => (diff ?? []).filter((c) => c.kind === kind).reduce((n, c) => n + c.text.trim().split(/\s+/).filter(Boolean).length, 0);
  const firstChangeRef = useRef<HTMLSpanElement>(null);
  const firstChange = diff ? diff.findIndex((c) => c.kind !== "same" && c.text.trim()) : -1;

  const highlighted = useMemo(() => {
    if (!current) return null;
    const re =
      target.quote && current.id === target.articleId
        ? quoteRegex(target.quote)
        : null;
    const m = re ? re.exec(current.text) : null;
    if (!m) return { before: current.text, match: null, after: "" };
    return {
      before: current.text.slice(0, m.index),
      match: m[0],
      after: current.text.slice(m.index + m[0].length),
    };
  }, [current, target]);

  useEffect(() => {
    if (tab === "texte" && highlighted?.match) {
      const t = setTimeout(
        () =>
          markRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          }),
        350,
      );
      return () => clearTimeout(t);
    }
  }, [tab, highlighted]);

  useEffect(() => {
    if (tab !== "changements" || firstChange < 0) return;
    const t = setTimeout(() => firstChangeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 450);
    return () => clearTimeout(t);
  }, [tab, firstChange, current]);

  const tabs: Array<{ id: Tab; label: string; hidden?: boolean }> = [
    { id: "texte", label: t("app.viewer.tab.texte") },
    {
      id: "historique",
      label: `${t("app.viewer.tab.historique")}${versions.length > 1 ? ` · ${versions.length}` : ""}`,
      hidden: versions.length < 2,
    },
    {
      id: "changements",
      label: t("app.viewer.tab.changements"),
      hidden: versions.length < 2,
    },
    {
      id: "liens",
      label: `${t("app.viewer.tab.liens")}${sheet?.links.length ? ` · ${sheet.links.length}` : ""}`,
      hidden: !sheet?.links.length,
    },
  ];

  return (
    <>
      <motion.div
        key="voile"
        className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        key="panneau"
        role="dialog"
        aria-label={t("app.viewer.dialogLabel")}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[640px] flex-col bg-white shadow-[-24px_0_60px_rgba(0,0,0,0.12)]"
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
      >
        <header className="border-b border-line px-6 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="fl-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                {sheet
                  ? (() => {
                      const k = `app.viewer.niveau.${sheet.article.niveau}`;
                      const v = t(k);
                      return v === k ? t("app.viewer.source") : v;
                    })()
                  : t("app.viewer.source")}
              </p>
              <h2 className="mt-1 text-[20px] leading-tight tracking-[-0.02em]">
                {sheet
                  ? sheet.article.niveau === "jurisprudence"
                    ? sheet.article.num
                    : t("app.viewer.article", { num: sheet.article.num ?? "" })
                  : t("app.viewer.loading")}
              </h2>
              {sheet && (
                <p className="mt-0.5 truncate text-[13px] text-body">
                  {sheet.article.code_title}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("app.viewer.close")}
              className="rounded-full p-2 text-muted transition-colors hover:bg-warm hover:text-ink"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {sheet && (
            <motion.div
              className="mt-3 flex flex-wrap items-center gap-2"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span
                className={`fl-badge ${sheet.article.etat === "VIGUEUR" ? "bg-ok/10 text-ok" : "bg-card text-muted"}`}
              >
                {t("app.viewer.stateSince", {
                  etat: etatLabel(sheet.article.etat),
                  date: fmt(sheet.article.date_debut),
                })}
              </span>
              {versions.length > 1 && (
                <span className="fl-badge bg-card text-body">
                  {t("app.viewer.versionsSince", {
                    n: versions.length,
                    year: new Date(versions[0].date_debut ?? "").getFullYear(),
                  })}
                </span>
              )}
              <a
                href={sheet.article.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="fl-mono ml-auto text-[12px] text-muted hover:text-red"
              >
                {t("app.viewer.official")}
              </a>
            </motion.div>
          )}
          {sheet?.article.section && (
            <p className="mt-2 line-clamp-2 text-[12px] text-muted">
              {sheet.article.section}
            </p>
          )}
          <nav className="relative mt-4 flex gap-1">
            {tabs
              .filter((t) => !t.hidden)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`relative rounded-full px-3 py-1.5 text-[13px] transition-colors ${tab === t.id ? "text-white" : "text-body hover:text-ink"}`}
                >
                  {tab === t.id && (
                    <motion.span
                      layoutId="onglet-article"
                      className="absolute inset-0 rounded-full bg-ink"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <p className="text-[14px] text-red-deep">
              {t("app.viewer.error")}
            </p>
          )}
          {!sheet && !error && (
            <div className="flex flex-col gap-3">
              {[90, 100, 75, 95, 60].map((w, i) => (
                <motion.div
                  key={i}
                  className="h-3 rounded-full bg-card"
                  style={{ width: `${w}%` }}
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}
          {sheet && current && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${tab}-${current.id}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22 }}
              >
                {tab === "texte" && highlighted && (
                  <>
                    {current.id !== sheet.article.id && (
                      <p className="mb-3 rounded-[10px] bg-card px-3 py-2 text-[12px] text-body">
                        {t("app.viewer.versionRange", {
                          from: fmt(current.date_debut),
                          to: fmt(current.date_fin),
                          etat: etatLabel(current.etat),
                        })}
                      </p>
                    )}
                    {target.quote &&
                      !highlighted.match &&
                      current.id === target.articleId && (
                        <p className="mb-3 rounded-[10px] bg-card px-3 py-2 text-[12px] text-muted">
                          {t("app.viewer.citedExcerpt", { quote: target.quote })}
                        </p>
                      )}
                    <p className="whitespace-pre-line text-[15px] leading-[1.75] text-ink">
                      {highlighted.before}
                      {highlighted.match && (
                        <motion.mark
                          ref={markRef}
                          className="rounded-[4px] px-0.5 text-ink"
                          initial={{ backgroundColor: "rgba(255,46,46,0)" }}
                          animate={{
                            backgroundColor: [
                              "rgba(255,46,46,0)",
                              "rgba(255,46,46,0.35)",
                              "rgba(255,46,46,0.16)",
                            ],
                          }}
                          transition={{
                            duration: 1.4,
                            delay: 0.4,
                            times: [0, 0.4, 1],
                          }}
                        >
                          {highlighted.match}
                        </motion.mark>
                      )}
                      {highlighted.after}
                    </p>
                  </>
                )}

                {tab === "historique" && (
                  <ol className="relative ml-2 border-l border-line">
                    {[...versions].reverse().map((v, i) => (
                      <motion.li
                        key={v.id}
                        className="relative mb-4 pl-5"
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        <span
                          className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ${v.etat === "VIGUEUR" ? "bg-red shadow-[0_0_0_4px_rgba(255,46,46,0.15)]" : "bg-line-2"}`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(v.id);
                            setTab("changements");
                          }}
                          className={`w-full rounded-[12px] border px-3.5 py-2.5 text-left transition-colors ${v.id === current.id ? "border-ink bg-warm" : "border-line hover:border-line-2"}`}
                        >
                          <span className="flex items-center justify-between gap-2 text-[13px] font-medium">
                            {fmt(v.date_debut)} → {fmt(v.date_fin)}
                            <span
                              className={`fl-badge ${v.etat === "VIGUEUR" ? "bg-ok/10 text-ok" : "bg-card text-muted"}`}
                            >
                              {etatLabel(v.etat)}
                            </span>
                          </span>
                          <span className="mt-1 line-clamp-2 block text-[12px] text-body">
                            {v.text.slice(0, 220)}
                          </span>
                        </button>
                      </motion.li>
                    ))}
                  </ol>
                )}

                {tab === "changements" &&
                  (diff && previous ? (
                    <>
                      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px]">
                        <select
                          value={current.id}
                          onChange={(e) => setSelected(e.target.value)}
                          className="rounded-full border border-line bg-white px-3 py-1.5 text-[12px]"
                          aria-label={t("app.viewer.compareLabel")}
                        >
                          {versions.slice(1).map((v) => (
                            <option key={v.id} value={v.id}>
                              {t("app.viewer.versionOf", { date: fmt(v.date_debut) })}
                            </option>
                          ))}
                        </select>
                        <span className="text-muted">
                          {t("app.viewer.comparedTo", { date: fmt(previous.date_debut) })}
                        </span>
                        <span className="ml-auto flex gap-2">
                          <span className="rounded-full bg-ok/10 px-2 py-0.5 text-ok">
                            {t("app.viewer.wordsAdded", { n: words("add") })}
                          </span>
                          <span className="rounded-full bg-red/10 px-2 py-0.5 text-red-deep">
                            {t("app.viewer.wordsRemoved", { n: words("del") })}
                          </span>
                        </span>
                      </div>
                      <p className="whitespace-pre-line text-[14.5px] leading-[1.75] text-ink">
                        {diff.map((c, i) =>
                          c.kind === "same" ? (
                            <span key={i}>{c.text}</span>
                          ) : (
                            <motion.span
                              key={i}
                              ref={i === firstChange ? firstChangeRef : undefined}
                              className={
                                c.kind === "add"
                                  ? "rounded-[3px] bg-ok/15 text-ink"
                                  : "rounded-[3px] bg-red/10 text-red-deep line-through"
                              }
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: Math.min(i * 0.015, 0.8) }}
                            >
                              {c.text}
                            </motion.span>
                          ),
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-[14px] text-muted">
                      {t("app.viewer.firstVersion")}
                    </p>
                  ))}

                {tab === "liens" && (
                  <ul className="flex flex-col gap-2">
                    {sheet.links.map((l, i) => (
                      <motion.li
                        key={`${l.id}-${l.type}-${i}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-[10px] border border-line px-3.5 py-2.5"
                      >
                        <span className="fl-mono text-[11px] uppercase tracking-[0.04em] text-muted">
                          {l.sens === "cité par"
                            ? t("app.viewer.link.citedBy")
                            : (() => {
                                const k = `app.viewer.link.${l.type}`;
                                const v = t(k);
                                return v === k ? l.type : v;
                              })()}
                        </span>
                        <p className="mt-0.5 text-[13px] text-ink">
                          {l.code_title
                            ? t("app.viewer.linkArt", { title: l.code_title, num: l.num ?? "" })
                            : (l.num ?? l.id)}
                        </p>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </motion.aside>
    </>
  );
}
