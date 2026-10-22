"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/app/analyse", label: "Analyse" },
  { href: "/app/veille", label: "Veille JO" },
  { href: "/app/donnees", label: "Données" },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="fl-container flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-[10px] px-3 py-2 text-[14px] whitespace-nowrap transition-colors ${active ? "bg-card text-ink" : "text-body hover:text-ink"}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
