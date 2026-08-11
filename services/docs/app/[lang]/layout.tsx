import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RootProvider } from "fumadocs-ui/provider/next";
import { i18n, translations } from "@/lib/i18n";
import { i18nProvider } from "fumadocs-ui/i18n";
import "../globals.css";

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>;

export async function generateMetadata({
  params,
}: RootLayoutProps): Promise<Metadata> {
  const { lang } = await params;
  const title =
    lang === "de" ? "JustApps-Dokumentation" : "JustApps documentation";

  return {
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description:
      lang === "de"
        ? "Anleitungen zum Bereitstellen, Konfigurieren und Betreiben von JustApps."
        : "Guides for deploying, configuring, and operating JustApps.",
    icons: {
      icon: "/docs/justapps-logo.svg",
      apple: "/docs/justapps-logo.svg",
    },
  };
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { lang } = await params;

  if (!i18n.languages.includes(lang as (typeof i18n.languages)[number])) {
    notFound();
  }

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider
          i18n={i18nProvider(translations, lang)}
          search={{ options: { api: "/docs/api/search" } }}
        >
          {children}
        </RootProvider>
      </body>
    </html>
  );
}
