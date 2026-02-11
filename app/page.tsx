import { getApps } from "@/config/apps";
import { AppGrid } from "@/components/AppGrid";

export default function Home() {
  const apps = getApps();
  
  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="inline-block max-w-[800px]">
          <h1 className="text-4xl lg:text-5xl font-extrabold tracking-tight text-bund-black mb-4">
            App-Store für die <br />
            <span className="text-bund-blue">PLAIN Plattform</span>
          </h1>
          <p className="text-xl text-default-600">
            Entdecken Sie Open-Source-Lösungen, Cloud-Native Applikationen und Standards <br className="hidden md:inline" /> 
            für die Digitalisierung staatlicher Leistungen und die digitale Souveränität.
          </p>
        </div>
      </section>

      <AppGrid initialApps={apps} />
    </div>
  );
}
