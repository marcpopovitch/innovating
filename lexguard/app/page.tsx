import Link from "next/link";
import { FranceGlobe } from "@/components/france-globe";
import { LiveStats } from "@/components/live-stats";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/reveal";
import { SiteNav } from "@/components/site-nav";
import { Arrow } from "@/components/ui/arrow";

const AGENTS = [
  { n: "01", name: "Analyste", text: "Découpe l'arrêté en dispositions : qui décide, quoi, où, pour combien de temps, sur quel fondement." },
  { n: "02", name: "Chercheurs", text: "Un agent par disposition, en parallèle. Ils fouillent les codes en vigueur, suivent les liens entre articles et relisent les actes déjà pris." },
  { n: "03", name: "Juge", text: "Raisonne sur la hiérarchie des normes et les dates d'entrée en vigueur. Chaque alerte cite l'article exact, mot pour mot." },
  { n: "04", name: "Contradicteur", text: "Attaque chaque alerte. Le code vérifie que l'extrait cité existe et que l'article est en vigueur. Sinon, l'alerte tombe." },
  { n: "05", name: "Rédacteur", text: "Classe par gravité et propose une rédaction corrigée, prête à repasser en signature." },
];

const ALERTS = [
  { name: "Conflit", text: "L'acte contredit une norme supérieure : un décret, un code, un règlement européen.", tone: "bg-red/10 text-red-deep" },
  { name: "Incompétence", text: "L'autorité n'a pas le pouvoir de prendre la mesure, par exemple quand une police spéciale appartient à l'État.", tone: "bg-orange/10 text-orange" },
  { name: "Doublon", text: "La règle existe déjà ailleurs, parfois dans des termes différents. Source de confusion et de contentieux.", tone: "bg-card text-ink" },
  { name: "Vide juridique", text: "L'acte renvoie à un texte abrogé ou à un décret d'application qui n'existe pas encore.", tone: "bg-card text-ink" },
];

const SOURCES = [
  { name: "Légifrance · codes en vigueur", text: "Dump officiel DILA LEGI : articles datés, versions successives et liens entre textes." },
  { name: "Journal officiel", text: "Incréments quotidiens DILA JORF : chaque nouveau texte devient un événement analysé." },
  { name: "Délibérations open data", text: "Actes des collectivités au format SCDL : la mémoire locale de chaque commune." },
  { name: "EUR-Lex", text: "Règlements et directives de l'Union cités par les textes français." },
];

export default function Home() {
  return (
    <>
      <SiteNav />
      <main className="flex-1">
        {/* ---- Hero ---- */}
        <section className="relative overflow-hidden pt-[150px] max-[720px]:pt-[120px]">
          <div className="fl-container text-center">
            <div>
              <p className="fl-eyebrow">Contrôle de légalité augmenté</p>
              <h1 className="fl-h1 mx-auto mt-5 max-w-[16ch]">Chaque arrêté vérifié contre tout le droit en vigueur. Avant signature.</h1>
              <p className="fl-lead mx-auto mt-[26px] max-w-[46ch]">
                Des agents IA lisent vos actes et le Journal officiel du jour, croisent les codes, les décrets et le droit européen, et signalent conflits, doublons et vides juridiques, sources à l&apos;appui.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4">
                <Link href="/app/analyse" className="hero__bigcta">
                  Vérifier un arrêté
                  <Arrow />
                </Link>
                <span className="text-[13px] text-muted">Pour les mairies, les intercommunalités et les préfectures</span>
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
              <p className="fl-eyebrow">Le problème</p>
              <h2 className="fl-h2 mt-4 max-w-[18ch]">Le droit s&apos;empile plus vite qu&apos;on ne peut le relire.</h2>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-3">
              {[
                { k: "≈ 35 000", t: "communes qui prennent chaque année des arrêtés et des délibérations, souvent sans juriste dédié." },
                { k: "101", t: "préfectures chargées du contrôle de légalité, qui ne peuvent examiner en détail qu'une fraction des actes reçus (estimation)." },
                { k: "Chaque jour", t: "de nouveaux décrets et arrêtés au Journal officiel, qui peuvent rendre caduc un acte local sans que personne ne le voie." },
              ].map((item, i) => (
                <Reveal key={item.k} delay={i * 0.08}>
                  <div className="fl-card h-full p-7">
                    <div className="text-[44px] font-medium leading-none tracking-[-0.04em]">{item.k}</div>
                    <p className="mt-4 text-body">{item.t}</p>
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
              <p className="fl-eyebrow">Comment ça marche</p>
              <h2 className="fl-h2 mt-4 max-w-[20ch]">Cinq agents qui travaillent comme un service juridique.</h2>
              <p className="fl-lead mt-6 max-w-[56ch]">Pas un simple appel à un modèle : une chaîne d&apos;agents qui cherchent, jugent, se contredisent et apprennent de vos retours.</p>
            </Reveal>
            <div className="mt-14 grid gap-3 md:grid-cols-5">
              {AGENTS.map((agent, i) => (
                <Reveal key={agent.n} delay={i * 0.06}>
                  <div className="fl-card--warm h-full rounded-[16px] p-6">
                    <span className="fl-mono text-[13px] text-red">{agent.n}</span>
                    <h3 className="mt-6 text-[22px]">{agent.name}</h3>
                    <p className="mt-3 text-[14px] leading-relaxed text-body">{agent.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal>
              <div className="mt-4 flex flex-col gap-4 rounded-[16px] border border-line p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <span className="fl-eyebrow">Mémoire</span>
                  <p className="mt-2 max-w-[62ch] text-body">
                    Chaque alerte validée ou rejetée par un juriste devient de la doctrine interne. Les agents la relisent avant de juger le prochain acte : Ciceron s&apos;améliore à chaque utilisation.
                  </p>
                </div>
                <Link href="/app/analyse" className="fl-btn fl-btn--ghost shrink-0">
                  Voir une analyse
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---- Types d'alertes ---- */}
        <section className="fl-section bg-warm">
          <div className="fl-container">
            <Reveal>
              <p className="fl-eyebrow">Ce que Ciceron détecte</p>
              <h2 className="fl-h2 mt-4 max-w-[16ch]">Quatre risques, une seule vérification.</h2>
            </Reveal>
            <div className="mt-14 grid gap-4 sm:grid-cols-2">
              {ALERTS.map((alert, i) => (
                <Reveal key={alert.name} delay={i * 0.06}>
                  <div className="fl-card h-full p-7">
                    <span className={`fl-badge ${alert.tone}`}>{alert.name}</span>
                    <p className="mt-5 text-[17px] leading-snug text-ink">{alert.text}</p>
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
              <p className="fl-eyebrow">Les données</p>
              <h2 className="fl-h2 mt-4 max-w-[18ch]">Uniquement des sources officielles. Et à jour chaque nuit.</h2>
              <p className="fl-lead mt-6 max-w-[58ch]">Chaque citation renvoie à Légifrance, seule version qui fait foi. Aucune alerte ne sort sans extrait vérifié.</p>
            </Reveal>
            <div className="mt-14 grid gap-4 md:grid-cols-4">
              {SOURCES.map((source, i) => (
                <Reveal key={source.name} delay={i * 0.06}>
                  <div className="h-full border-t border-line-2 pt-5">
                    <h3 className="text-[18px] leading-tight">{source.name}</h3>
                    <p className="mt-3 text-[14px] text-body">{source.text}</p>
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
              <h2 className="fl-h2 mx-auto max-w-[18ch]">Signez vos arrêtés l&apos;esprit tranquille.</h2>
              <p className="fl-lead mx-auto mt-5 max-w-[44ch]">Collez un projet d&apos;arrêté, obtenez un avis sourcé en quelques minutes.</p>
              <div className="mt-10">
                <Link href="/app/analyse" className="hero__bigcta">
                  Vérifier un arrêté
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
            <p className="mt-4 max-w-[44ch] text-[14px] text-white/60">
              Vigilance et détection d&apos;incohérences législatives pour les collectivités. Prototype réalisé au hackathon AI Innovate, Paris, octobre 2026.
            </p>
          </div>
          <p className="text-[13px] text-white/40">Données : DILA (Licence Ouverte 2.0), EUR-Lex. Seule la version publiée sur Légifrance fait foi.</p>
        </div>
      </footer>
    </>
  );
}
