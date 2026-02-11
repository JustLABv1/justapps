import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "App-Store für die Deutsche Verwaltung",
  description: "Zentraler Marktplatz für Softwarelösungen der Bundesverwaltung, Länder und Kommunen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        <Providers>
          <div className="relative flex flex-col min-h-screen">
            {/* German Branding Border */}
            <div className="h-1 w-full flex">
              <div className="h-full w-1/3 bg-black"></div>
              <div className="h-full w-1/3 bg-[#FF0000]"></div>
              <div className="h-full w-1/3 bg-[#FFCC00]"></div>
            </div>
            
            <Navigation />

            <main className="container mx-auto max-w-7xl pt-16 px-6 flex-grow">
              {children}
            </main>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
