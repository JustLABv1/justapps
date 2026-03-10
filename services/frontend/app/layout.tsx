import { FlagBar } from "@/components/FlagBar";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { TopBanner } from "@/components/TopBanner";
import { Providers } from "@/components/providers";
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

export const metadata: Metadata = {
  title: "JustApps",
  description: "Zentraler Community Store für Softwarelösungen der Bundesverwaltung, Länder und Kommunen.",
};

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
          <div className="relative flex flex-col min-h-screen">
            <FlagBar />

            <Navigation />

            <TopBanner />

            <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
