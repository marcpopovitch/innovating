import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { FranceGlobe } from "@/components/france-globe";
import { LiveStats } from "@/components/live-stats";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { SiteNav } from "@/components/site-nav";
import { Arrow } from "@/components/ui/arrow";

const AGENTS = ["01", "02", "03", "04", "05"];

const ALERTS = [
  "bg-red/10 text-red-deep",
  "bg-orange/10 text-orange",
  "bg-card text-ink",
  "bg-card text-ink",
];

const SOURCES = [1, 2, 3, 4];

export default async function Home() {
  const { t } = await getT();
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="relative overflow-hidden pt-[150px] max-[720px]:pt-[120px]">
          <div className="fl-container text-center">
            <div>
              <p className="fl-eyebrow">{t("landing.hero.eyebrow")}</p>
              <h1 className="fl-h1 mx-auto mt-5 max-w-[16ch]">{t("landing.hero.title")}</h1>
              <p className="fl-lead mx-auto mt-[26px] max-w-[46ch]">{t("landing.hero.lead")}</p>
              <div className="mt-10 flex flex-col items-center gap-4">
                <Link href="/app/analyse" className="hero__bigcta">
                  {t("landing.cta.check")}
                  <Arrow />
                </Link>
                <span className="text-[13px] text-muted">{t("landing.hero.audience")}</span>
              </div>
            </div>
          </div>
          <div className="relative mx-auto mt-6 w-full max-w-[680px] px-6">
            <FranceGlobe />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
          </div>
        </section>

        {/* ---- Problème ---- */}
        <section id="produit" className="fl-section bg-warm">
          <div className="fl-container">
            <Reveal>
              <p className="fl-eyebrow">{t("landing.problem.eyebrow")}</p>
              <h2 className="fl-h2 mt-4 max-w-[18ch]">{t("landing.problem.title")}</h2>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((n, i) => (
                <Reveal key={n} delay={i * 0.08}>
                  <div className="fl-card h-full p-7">
                    <div className="text-[44px] font-medium leading-none tracking-[-0.04em]">{t(`landing.problem.${n}.k`)}</div>
                    <p className="mt-4 text-body">{t(`landing.problem.${n}.t`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Comment ça marche ---- */}
        <section className="fl-section">
          <div className="fl-container">
            <Reveal>
              <p className="fl-eyebrow">{t("landing.how.eyebrow")}</p>
              <h2 className="fl-h2 mt-4 max-w-[20ch]">{t("landing.how.title")}</h2>
              <p className="fl-lead mt-6 max-w-[56ch]">{t("landing.how.lead")}</p>
            </Reveal>
            <div className="mt-14 grid gap-3 md:grid-cols-5">
              {AGENTS.map((n, i) => (
                <Reveal key={n} delay={i * 0.06}>
                  <div className="fl-card--warm h-full rounded-[16px] p-6">
                    <span className="fl-mono text-[13px] text-red">{n}</span>
                    <h3 className="mt-6 text-[22px]">{t(`landing.agent.${i + 1}.name`)}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-body">{t(`landing.agent.${i + 1}.text`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <div className="mt-4 flex flex-col gap-4 rounded-[16px] border border-line p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="fl-eyebrow">{t("landing.memory.label")}</span>
                  <p className="mt-2 max-w-[62ch] text-body">{t("landing.memory.text")}</p>
                </div>
                <Link href="/app/analyse" className="fl-btn fl-btn--ghost shrink-0">
                  {t("landing.memory.cta")}
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- Types d'alertes ---- */}
        <section className="fl-section bg-warm">
          <div className="fl-container">
            <Reveal>
              <p className="fl-eyebrow">{t("landing.alerts.eyebrow")}</p>
              <h2 className="fl-h2 mt-4 max-w-[16ch]">{t("landing.alerts.title")}</h2>
            </Reveal>
            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              {ALERTS.map((tone, i) => (
                <Reveal key={tone + i} delay={i * 0.06}>
                  <div className="fl-card h-full p-7">
                    <span className={`fl-badge ${tone}`}>{t(`landing.alert.${i + 1}.name`)}</span>
                    <p className="mt-5 text-[17px] leading-snug text-ink">{t(`landing.alert.${i + 1}.text`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Données ---- */}
        <section id="donnees" className="fl-section">
          <div className="fl-container">
            <Reveal>
              <p className="fl-eyebrow">{t("landing.data.eyebrow")}</p>
              <h2 className="fl-h2 mt-4 max-w-[18ch]">{t("landing.data.title")}</h2>
              <p className="fl-lead mt-6 max-w-[58ch]">{t("landing.data.lead")}</p>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-4">
              {SOURCES.map((n, i) => (
                <Reveal key={n} delay={i * 0.06}>
                  <div className="h-full border-t border-line-2 pt-5">
                    <h3 className="text-[18px] leading-tight">{t(`landing.source.${n}.name`)}</h3>
                    <p className="mt-3 text-[14px] text-body">{t(`landing.source.${n}.text`)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <div className="mt-12">
              <LiveStats />
            </div>
          </div>
        </section>

        {/* ---- CTA final ---- */}
        <section className="fl-section pt-0">
          <div className="fl-container">
            <div className="rounded-[24px] bg-warm px-6 py-20 text-center">
              <h2 className="fl-h2 mx-auto max-w-[18ch]">{t("landing.final.title")}</h2>
              <p className="fl-lead mx-auto mt-5 max-w-[44ch]">{t("landing.final.lead")}</p>
              <div className="mt-10">
                <Link href="/app/analyse" className="hero__bigcta">
                  {t("landing.cta.check")}
                  <Arrow />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#050505] py-16 text-white">
        <div className="fl-container flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <Logo light />
            <p className="mt-4 max-w-[44ch] text-[14px] text-white/60">{t("landing.footer.about")}</p>
          </div>
          <p className="text-[13px] text-white/40">{t("landing.footer.data")}</p>
        </div>
      </footer>
    </>
  );
}
