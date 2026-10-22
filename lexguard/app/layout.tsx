import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LangProvider } from "@/components/lang-provider";
import { getLang, getT } from "@/lib/i18n/server";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("meta.title"), description: t("meta.description") };
}

// La langue vient d'un cookie (donnée dynamique) : on la lit sous Suspense, pour que la coque reste préparée à l'avance.
async function Localized({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  return (
    <LangProvider lang={lang}>
      <script dangerouslySetInnerHTML={{ __html: `document.documentElement.lang=${JSON.stringify(lang)}` }} />
      {children}
    </LangProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense>
          <Localized>{children}</Localized>
        </Suspense>
      </body>
    </html>
  );
}
