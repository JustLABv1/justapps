import { AppGrid } from "@/components/AppGrid";
import { fetchApi } from "@/lib/api";

export const dynamic = 'force-dynamic';

async function getApps() {
  try {
    const res = await fetchApi('/apps', { cache: 'no-store' });
    if (!res.ok) {
      console.error(`Failed to fetch apps: ${res.status} ${res.statusText}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Error in getApps SSR:", e);
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
