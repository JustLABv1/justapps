import { getApps } from "@/config/apps";
import { notFound } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Link, Chip, Separator } from "@heroui/react";
import { ChevronLeft, ExternalLink, Github, Scale, Layers, BookOpen } from "lucide-react";
import NextLink from "next/link";
import { DeploymentAssistant } from "@/components/DeploymentAssistant";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AppPage({ params }: PageProps) {
  const { id } = await params;
  const apps = getApps();
  const app = apps.find(a => a.id === id);

  if (!app) {
    notFound();
  }

  const content = app.markdownContent || `# ${app.name}\n\n${app.description}\n\n*Keine detaillierte Dokumentation verfügbar.*`;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <NextLink href="/" className="inline-flex items-center gap-2 text-sm font-bold text-default-600 hover:text-bund-blue transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </NextLink>
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-bund-light-blue flex items-center justify-center text-5xl shadow-inner flex-shrink-0">
          {app.icon || "🏛️"}
        </div>
        <div className="flex-grow pt-2">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-4xl font-extrabold text-bund-black">{app.name}</h1>
            <Chip color="accent" variant="soft" size="sm" className="uppercase tracking-wider font-bold">
              {app.category}
            </Chip>
          </div>
          <p className="text-xl text-default-500 mb-6">
            {app.description}
          </p>
          
          <div className="flex flex-wrap gap-4">
            {app.liveUrl && (
              <Link 
                href={app.liveUrl} 
                target="_blank" 
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold h-12 px-6 bg-bund-blue text-white hover:bg-bund-blue/90 no-underline transition-all shadow-md active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                Live Demo besuchen
              </Link>
            )}
            {app.repoUrl && (
              <Link 
                href={app.repoUrl} 
                target="_blank" 
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold h-12 px-6 border border-default-300 bg-white hover:bg-default-50 no-underline text-default-700 transition-all shadow-sm active:scale-95"
              >
                <Github className="w-4 h-4" />
                Repository
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-8">
          <div className="prose prose-bund max-w-none bg-white rounded-2xl p-8 border border-default-200 shadow-sm min-h-[400px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>

          <DeploymentAssistant app={app} />
        </div>

        <div className="space-y-8">
          <div className="bg-default-50 rounded-2xl p-6 border border-default-200">
            <h3 className="text-sm font-bold text-default-400 uppercase tracking-widest mb-4">Software Details</h3>
            
            <div className="space-y-6">
              {app.techStack && (
                <div>
                  <div className="flex items-center gap-2 text-default-900 font-bold mb-2">
                    <Layers className="w-4 h-4" />
                    Technical Stack
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {app.techStack.map(tech => (
                      <Chip key={tech} size="sm" variant="secondary" className="bg-white">
                        {tech}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {app.license && (
                <div>
                  <div className="flex items-center gap-2 text-default-900 font-bold mb-2">
                    <Scale className="w-4 h-4" />
                    Lizenz
                  </div>
                  <p className="text-sm text-default-600 pl-6 border-l-2 border-bund-gold">
                    {app.license}
                  </p>
                </div>
              )}

              {app.docsUrl && (
                <div>
                  <div className="flex items-center gap-2 text-default-900 font-bold mb-2">
                    <BookOpen className="w-4 h-4" />
                    Dokumentation
                  </div>
                  <Link 
                    href={app.docsUrl} 
                    target="_blank" 
                    className="text-sm text-bund-blue hover:underline pl-6"
                  >
                    Offizielle Dokumente ansehen
                  </Link>
                </div>
              )}

              <Separator />
              
              <div className="pt-2">
                <div className="text-[10px] text-default-400 uppercase font-bold mb-1">ID: {app.id}</div>
                <div className="text-[10px] text-default-400 font-medium italic">Zuletzt aktualisiert: 02.02.2026</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
