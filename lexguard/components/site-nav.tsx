import Link from "next/link";
import { Logo } from "@/components/logo";
import { LangSwitch } from "@/components/lang-switch";
import { Arrow } from "@/components/ui/arrow";
import { getT } from "@/lib/i18n/server";

export async function SiteNav() {
  const { t } = await getT();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/80 backdrop-blur-md">
      <div className="fl-container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] text-body md:flex">
          <a href="#produit" className="hover:text-ink">{t("landing.nav.product")}</a>
          <a href="#donnees" className="hover:text-ink">{t("landing.nav.data")}</a>
          <Link href="/app/analyse" className="hover:text-ink">{t("landing.nav.analysis")}</Link>
        </nav>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <Link href="/app/analyse" className="fl-btn fl-btn--red fl-btn--sm">
            {t("landing.nav.try")}
            <Arrow size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}
