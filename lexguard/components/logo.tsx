import Link from "next/link";

/** Logo texte : un bouclier rouge minimal + le nom. */
export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-medium tracking-tight ${light ? "text-white" : "text-ink"}`}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2.5 4 5.5v6.2c0 4.6 3.4 8.6 8 9.8 4.6-1.2 8-5.2 8-9.8V5.5l-8-3Z" fill="#ff2e2e" />
        <path d="m8.5 12 2.4 2.4 4.6-4.8" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[17px]">Ciceron</span>
    </Link>
  );
}
