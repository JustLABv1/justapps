import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Marktplatz für PLAIN",
  description: "Zentraler Marktplatz für Softwarelösungen der Bundesverwaltung, Länder und Kommunen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Providers>
          <div className="relative flex flex-col min-h-screen">
            {/* German flag accent stripe */}
            <div className="h-1 w-full flex shrink-0" aria-hidden="true">
              <div className="h-full w-1/3 bg-[#000]" />
              <div className="h-full w-1/3 bg-gov-red" />
              <div className="h-full w-1/3 bg-gov-gold" />
            </div>

            <Navigation />

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
