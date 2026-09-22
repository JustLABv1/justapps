import { AppShell } from '@/components/AppShell';
import { Providers } from "@/components/providers";
import { getApiUrl } from "@/lib/apiUrl";
import type { Metadata } from "next";
// import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

/*
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
*/

const defaultTitle = "JustApps";
const defaultDescription =
  "Zentraler App Store für Softwarelösungen der Bundesverwaltung, Länder und Kommunen.";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const response = await fetch(`${getApiUrl()}/settings`, {
      cache: "no-store",
    });
    if (response.ok) {
      const settings = (await response.json()) as {
        storeName?: string;
        storeDescription?: string;
      };
      return {
        title: settings.storeName?.trim() || defaultTitle,
        description: settings.storeDescription?.trim() || defaultDescription,
      };
    }
  } catch {
    // The frontend must remain renderable while the backend is starting.
  }

  return {
    title: defaultTitle,
    description: defaultDescription,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        // className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        className={`antialiased min-h-screen flex flex-col`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
