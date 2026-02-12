import { AppGrid } from "@/components/AppGrid";

export const dynamic = 'force-dynamic';

async function getApps() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
  try {
    const res = await fetch(`${apiUrl}/apps`, { cache: 'no-store' });
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    console.error(e);
    return [];
  }
}

export default async function Home() {
  const apps = await getApps();
  
  return (
    <div className="flex flex-col gap-10">
      {/* Hero section */}
      <section className="text-center py-8 md:py-12">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground mb-4">
          App-Store für die{" "}
          <span className="text-accent">PLAIN Plattform</span>
        </h1>
        <p className="text-base sm:text-lg text-muted max-w-2xl mx-auto leading-relaxed">
          Entdecken Sie Open-Source-Lösungen, Cloud-Native Applikationen und Standards
          für die Digitalisierung staatlicher Leistungen.
        </p>
      </section>

      <AppGrid initialApps={apps} />
    </div>
  );
}
