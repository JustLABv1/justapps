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
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="inline-block max-w-[800px]">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-bund-black mb-4">
            App-Store für die <br />
            <span className="text-bund-blue">PLAIN Plattform</span>
          </h1>
          <p className="text-xl text-muted">
            Entdecken Sie Open-Source-Lösungen, Cloud-Native Applikationen und Standards <br className="hidden md:inline" /> 
            für die Digitalisierung staatlicher Leistungen und die digitale Souveränität.
          </p>
        </div>
      </section>

      <AppGrid initialApps={apps} />
    </div>
  );
}
