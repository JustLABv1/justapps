'use client';

import { DeploymentAssistant } from "@/components/DeploymentAssistant";
import { RatingSection } from "@/components/RatingSection";
import { AppConfig } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { Button, Chip, Link, Separator } from "@heroui/react";
import { BookOpen, Check, ChevronLeft, Copy, ExternalLink, Github, Layers, LayoutDashboard, Loader2, Pencil, Scale, Star } from "lucide-react";
import NextLink from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const HelmIcon = ({ className }: { className?: string }) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2.25a.75.75 0 01.75.75v1.306a9.002 9.002 0 016.694 6.694H21a.75.75 0 010 1.5h-1.306a9.002 9.002 0 01-6.694 6.694V21a.75.75 0 01-1.5 0v-1.306a9.002 9.002 0 01-6.694-6.694H3a.75.75 0 010-1.5h1.306a9.002 9.002 0 016.694-6.694V3a.75.75 0 01.75-.75zM5.8 11.25a7.502 7.502 0 005.45 5.45v-5.45H5.8zm6.95 5.45a7.502 7.502 0 005.45-5.45h-5.45v5.45zM18.2 12.75a7.502 7.502 0 00-5.45-5.45v5.45h5.45zm-6.95-5.45a7.502 7.502 0 00-5.45 5.45h5.45v-5.45z"/>
  </svg>
);

const DockerIcon = ({ className }: { className?: string }) => (
  <svg role="img" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M13.983 11.078h2.119c.102 0 .186-.084.186-.186V9.112c0-.102-.084-.186-.186-.186h-2.119c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.95 0h2.118c.102 0 .186-.084.186-.186V9.112c0-.102-.084-.186-.186-.186h-2.118c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.935 0h2.119c.102 0 .186-.084.186-.186V9.112c0-.102-.084-.186-.186-.186h-2.119c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.937 0H5.28c.102 0 .186-.084.186-.186V9.112c0-.102-.084-.186-.186-.186H3.144c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm5.872-2.935h2.118c.102 0 .186-.084.186-.186V6.177c0-.102-.084-.186-.186-.186h-2.118c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.935 0h2.119c.102 0 .186-.084.186-.186V6.177c0-.102-.084-.186-.186-.186h-2.119c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.937 0H5.28c.102 0 .186-.084.186-.186V6.177c0-.102-.084-.186-.186-.186H3.144c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zM8.215 5.212h2.119c.102 0 .186-.084.186-.186V3.246c0-.102-.084-.186-.186-.186H8.215c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm-2.937 0H7.397c.102 0 .186-.084.186-.186V3.246c0-.102-.084-.186-.186-.186H5.278c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zm12.556 5.866c0 .102.084.186.186.186h2.119c.102 0 .186-.084.186-.186v-1.78c0-.102-.084-.186-.186-.186h-2.119c-.102 0-.186.084-.186.186v1.78zm.186-2.935h2.119c.102 0 .186-.084.186-.186V6.177c0-.102-.084-.186-.186-.186h-2.119c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186zM0 12.503c0 3.332 2.002 6.095 4.885 7.19.882.333 1.01.213 1.01-.84v-1.12c0-1.077-.123-1.196-1.01-1.554-1.89-.766-3.111-2.483-3.111-4.45 0-.156.012-.312.035-.467h3.313c.102 0 .186-.084.186-.186v-1.78c0-.102-.084-.186-.186-.186H.907c.227-2.673 1.584-4.81 3.593-5.74.882-.408 1.01-.527 1.01-1.554V.782c0-1.053-.128-1.173-1.01-.84C1.613 1.109 0 4.223 0 7.82V12.5zM24 14.181c0-1.01-.227-1.464-.326-1.61-.17-.253-.418-.466-.757-.655-.386-.217-.925-.388-1.574-.5-.65-.112-1.396-.168-2.173-.168h-5.187c-.102 0-.186.084-.186.186v1.78c0 .102.084.186.186.186h4.524c.71 0 1.343.045 1.838.128.497.084.856.2 1.07.332.227.142.326.315.326.541v.784c0 .84-.123.96-.921 1.259-2.332.863-5.278 1.411-8.525 1.581-3.245-.17-6.193-.718-8.525-1.581-.798-.299-.921-.418-.921-1.259v-3.32h5.872c.102 0 .186-.084.186-.186v-1.78c0-.102-.084-.186-.186-.186H4.885c0-1.05.176-1.861.47-2.5 1.028-2.13 3.655-3.5 6.445-3.5s 5.417 1.37 6.445 3.5c.294.639.47 1.45.47 2.5 0 2.21 1.79 4 4 4 1.285 0 1.285 1.418 1.285 1.418z"/>
  </svg>
);

export default function AppPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const router = useRouter();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  useEffect(() => {
    async function loadApp() {
      if (!id) return;
      
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
      try {
        const res = await fetch(`${apiUrl}/apps/${id}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setApp(data);
        } else {
          setApp(null);
        }
      } catch (err) {
        console.error(err);
        setApp(null);
      } finally {
        setLoading(false);
      }
    }
    loadApp();
  }, [id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-bund-blue" />
      <p className="text-muted font-medium">App-Details werden geladen...</p>
    </div>
  );
  
  if (!app) return notFound();

  const isAdmin = user?.role === 'admin';
  const content = app.markdownContent || `# ${app.name}\n\n${app.description}\n\n*Keine detaillierte Dokumentation verfügbar.*`;

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-8">
        <NextLink href="/" className="inline-flex items-center gap-2 text-sm font-bold text-muted hover:text-bund-blue transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </NextLink>

        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="secondary" 
              className="font-bold gap-2"
              onPress={() => router.push(`/management?edit=${app.id}`)}
            >
              <Pencil className="w-3.5 h-3.5" />
              App bearbeiten
            </Button>
            <Button 
              size="sm" 
              variant="tertiary"
              className="font-bold gap-2"
              onPress={() => router.push('/management')}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Verwaltung
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start mb-12">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-bund-light-blue flex items-center justify-center text-5xl shadow-inner flex-shrink-0">
          {app.icon || "🏛️"}
        </div>
        <div className="flex-grow pt-2">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-4xl font-extrabold text-foreground">{app.name}</h1>
            <Chip color="accent" variant="soft" size="sm" className="uppercase tracking-wider font-bold">
              {app.category}
            </Chip>
            {app.isFeatured && (
              <Chip color="success" variant="soft" size="sm" className="font-bold">CURATED</Chip>
            )}
            {app.ratingCount !== undefined && app.ratingCount > 0 && (
              <div className="flex items-center gap-1.5 ml-1 px-2.5 py-1 bg-bund-gold/10 rounded-full border border-bund-gold/20">
                <Star className="w-3.5 h-3.5 fill-bund-gold text-bund-gold" />
                <span className="text-sm font-extrabold text-bund-blue">{(app.ratingAvg || 0).toFixed(1)}</span>
                <span className="text-[10px] text-muted font-bold ml-1">{app.ratingCount}</span>
              </div>
            )}
          </div>
          <p className="text-xl text-muted mb-6">
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
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold h-12 px-6 border border-border bg-surface hover:bg-default no-underline text-foreground transition-all shadow-sm active:scale-95"
              >
                <Github className="w-4 h-4" />
                Repository
              </Link>
            )}
            {app.helmRepo && (
              <Link 
                href={app.helmRepo}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold h-12 px-6 border border-border bg-surface hover:bg-default no-underline text-foreground transition-all shadow-sm active:scale-95"
              >
                <HelmIcon className="w-4 h-4 text-bund-blue" />
                Helm Chart
                <ExternalLink className="w-3.5 h-3.5 opacity-50" />
              </Link>
            )}
            {app.dockerRepo && (
              <Link 
                href={app.dockerRepo}
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold h-12 px-6 border border-border bg-surface hover:bg-default no-underline text-foreground transition-all shadow-sm active:scale-95"
              >
                <DockerIcon className="w-4 h-4 text-[#2496ED]" />
                Docker Registry
                <ExternalLink className="w-3.5 h-3.5 opacity-50" />
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        <div className="md:col-span-2 space-y-8">
          <div className="prose prose-bund max-w-none bg-surface rounded-2xl p-8 border border-border shadow-sm min-h-[400px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>

          <DeploymentAssistant app={app} />
          
          <RatingSection appId={app.id} />
        </div>

        <div className="space-y-8">
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">Software Details</h3>
            
            <div className="space-y-6">
              {app.techStack && (
                <div>
                  <div className="flex items-center gap-2 text-foreground font-bold mb-2">
                    <Layers className="w-4 h-4" />
                    Technical Stack
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {app.techStack.map((tech: string) => (
                      <Chip key={tech} size="sm" variant="secondary">
                        {tech}
                      </Chip>
                    ))}
                  </div>
                </div>
              )}

              {app.license && (
                <div>
                  <div className="flex items-center gap-2 text-foreground font-bold mb-2">
                    <Scale className="w-4 h-4" />
                    Lizenz
                  </div>
                  <p className="text-sm text-muted pl-6 border-l-2 border-bund-gold">
                    {app.license}
                  </p>
                </div>
              )}

              {app.docsUrl && (
                <div>
                  <div className="flex items-center gap-2 text-foreground font-bold mb-2">
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
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
            <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-4">Fachliche Details</h3>
            
            <div className="space-y-4">
              {app.focus && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Themenfeld / Schwerpunkt</div>
                  <div className="text-sm font-bold text-foreground">{app.focus}</div>
                </div>
              )}
              {app.appType && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Anwendungstyp</div>
                  <div className="text-sm font-bold text-foreground">{app.appType}</div>
                </div>
              )}
              {app.status && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Status</div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${app.status.toLowerCase().includes('produktiv') ? 'bg-success' : 'bg-bund-gold'}`} />
                    <div className="text-sm font-bold text-foreground">{app.status}</div>
                  </div>
                </div>
              )}
              {app.useCase && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Ziel Anwendungsfall</div>
                  <div className="text-sm font-medium text-muted leading-snug">{app.useCase}</div>
                </div>
              )}
              {app.contactPerson && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Ansprechpartner</div>
                  <div className="text-sm font-bold text-bund-blue">{app.contactPerson}</div>
                </div>
              )}
              {app.visualization && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Visualisierung</div>
                  <div className="text-sm font-bold text-foreground">{app.visualization}</div>
                </div>
              )}
              {app.deployment && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Deployment</div>
                  <div className="text-sm font-bold text-foreground">{app.deployment}</div>
                </div>
              )}
              {app.infrastructure && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Infrastruktur</div>
                  <div className="text-sm font-bold text-foreground">{app.infrastructure}</div>
                </div>
              )}
              {app.database && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Datenbasis</div>
                  <div className="text-sm font-bold text-foreground">{app.database}</div>
                </div>
              )}
              {app.transferability && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Übertragbarkeit</div>
                  <div className="text-sm font-medium text-muted leading-snug">{app.transferability}</div>
                </div>
              )}
              {app.additionalInfo && (
                <div>
                  <div className="text-[10px] text-muted uppercase font-bold mb-1 tracking-wider">Sonstiges</div>
                  <div className="text-sm text-muted italic leading-snug">{app.additionalInfo}</div>
                </div>
              )}
            </div>
          </div>

          {(app.helmRepo || app.dockerRepo) && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    {app.helmRepo && (
                      <div>
                        <div className="flex items-center gap-2 text-foreground font-bold mb-2">
                          <HelmIcon className="w-4 h-4 text-bund-blue" />
                          Helm Chart
                        </div>
                        <div className="pl-6">
                          <code className="text-[10px] bg-default p-1.5 rounded block mb-2 font-mono truncate">
                            {app.helmRepo}
                          </code>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-7 text-[10px] font-bold gap-1.5"
                            onPress={() => copyToClipboard(`helm pull ${app.helmRepo}`, 'helm-side')}
                          >
                            {copied === 'helm-side' ? "Kopiert!" : "Pull Befehl kopieren"}
                            {copied === 'helm-side' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )}

                    {app.dockerRepo && (
                      <div>
                        <div className="flex items-center gap-2 text-foreground font-bold mb-2">
                          <DockerIcon className="w-4 h-4 text-[#2496ED]" />
                          Docker Image
                        </div>
                        <div className="pl-6">
                          <code className="text-[10px] bg-default p-1.5 rounded block mb-2 font-mono truncate">
                            {app.dockerRepo}
                          </code>
                          <Button 
                            size="sm" 
                            variant="secondary" 
                            className="h-7 text-[10px] font-bold gap-1.5"
                            onPress={() => copyToClipboard(`docker pull ${app.dockerRepo}`, 'docker-side')}
                          >
                            {copied === 'docker-side' ? "Kopiert!" : "Pull Befehl kopieren"}
                            {copied === 'docker-side' ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <Separator />
              
              <div className="pt-2">
                <div className="text-[10px] text-muted uppercase font-bold mb-1">ID: {app.id}</div>
                <div className="text-[10px] text-muted font-medium italic">
                  Zuletzt aktualisiert: {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'Unbekannt'}
                </div>
              </div>
            </div>
          </div>
        </div>
  );
}
