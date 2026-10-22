import Link from "next/link";
import { Logo } from "@/components/logo";
import { Arrow } from "@/components/ui/arrow";

export function SiteNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-white/80 backdrop-blur-md">
      <div className="fl-container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-7 text-[15px] text-body md:flex">
          <a href="#produit" className="hover:text-ink">Produit</a>
          <a href="#donnees" className="hover:text-ink">Données</a>
          <Link href="/app/analyse" className="hover:text-ink">Analyse</Link>
        </nav>
        <Link href="/app/analyse" className="fl-btn fl-btn--red fl-btn--sm">
          Essayer
          <Arrow size={14} />
        </Link>
      </div>
    </header>
  );
}
