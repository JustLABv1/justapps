'use client';

import { DeploymentAssistant } from "@/components/DeploymentAssistant";
import { RatingSection } from "@/components/RatingSection";
import { AppConfig } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { useSettings } from "@/context/SettingsContext";
import { fetchApi } from "@/lib/api";
import { getAppStatusMeta, isDraftStatus } from "@/lib/appStatus";
import { resolveIcon } from "@/lib/detailFieldIcons";
import { Chip, Dropdown, Link, Tabs, Tooltip } from "@heroui/react";
import {
    AlertTriangle,
    BookOpen,
    ChevronLeft,
    ExternalLink,
    Github,
    History,
    Layers,
    LayoutDashboard,
    Link2,
    Loader2,
    Pencil,
    Scale,
    Server,
    Share2,
    Star
} from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Helper: renders a labelled metadata card ── */
function MetaCard({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1.5 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/30 transition-colors">
      <dt className="text-xs text-muted uppercase tracking-wider font-semibold flex items-center gap-2">
        {icon && <span className="text-accent">{icon}</span>}
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function AppPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const { settings } = useSettings();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadApp() {
      if (!id) return;
      try {
        const res = await fetchApi(`/apps/${id}`, { cache: 'no-store' });
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
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
      <p className="text-muted font-medium">App-Details werden geladen...</p>
    </div>
  );

  if (!app) return notFound();

  const isAdmin = user?.role === 'admin';
  const isOwner = !!user?.id && (app.ownerId === user.id || app.owner?.id === user.id);
  if (isDraftStatus(app.status) && !isOwner && !isAdmin) return notFound();

  const content = app.markdownContent || `# ${app.name}\n\n${app.description}\n\n*Keine detaillierte Dokumentation verfügbar.*`;
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;
  const statusInfo = getAppStatusMeta(app.status);
  const repositories = app.repositories && app.repositories.length > 0
    ? app.repositories
    : (app.repoUrl ? [{ label: 'Quellcode', url: app.repoUrl }] : []);
  const customLinks = app.customLinks || [];

  /* Build metadata pairs from the admin-configured field schema + app's customFields values */
  const fieldValueMap = new Map((app.customFields ?? []).map(f => [f.key, f.value]));
  const metaFields = (settings.detailFields ?? [])
    .map(def => ({ label: def.label, value: fieldValueMap.get(def.key), icon: resolveIcon(def.icon) }))
    .filter(f => f.value);
  // Always show Status separately if set
  if (statusInfo?.label) {
    metaFields.unshift({ label: "Status", value: statusInfo.label, icon: resolveIcon('Activity') });
  }
  if (app.authority) {
    metaFields.push({ label: "Herausgeber", value: app.authority, icon: resolveIcon('Building2') });
  }

  return (
    <div className="max-w-5xl mx-auto pb-20">

      {/* ── Nav row ── */}
      <div className="flex justify-between items-center mb-6">
        <NextLink href="/" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border text-sm font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-all shadow-sm">
          <ChevronLeft className="w-4 h-4" />
          Zurück zur Übersicht
        </NextLink>

        {isAdmin && (
          <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 shadow-sm">
            <NextLink
              href={`/verwaltung/apps/${app.id}/edit`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Bearbeiten
            </NextLink>
            <div className="w-px h-4 bg-border mx-1" />
            <NextLink
              href="/verwaltung"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-muted hover:text-foreground hover:bg-surface-secondary transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Verwaltung
            </NextLink>
          </div>
        )}
      </div>

      {/* ── Known issue banner ── */}
      {app.knownIssue && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning">Bekanntes Problem</p>
            <p className="text-sm text-warning/80 mt-0.5">{app.knownIssue}</p>
          </div>
        </div>
      )}

      {/* ── Hero ── */}
      <header className="relative overflow-hidden rounded-3xl bg-surface-secondary border border-border p-6 md:p-8 mb-8">
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-full h-full max-w-2xl pointer-events-none opacity-30 dark:opacity-20">
          <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[80%] rounded-full bg-accent/20 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start gap-6 md:gap-8">
          <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-center text-4xl md:text-6xl shrink-0 overflow-hidden">
            {app.icon?.startsWith('http') ? (
              <Image 
                src={app.icon} 
                alt={app.name} 
                fill 
                className="object-contain p-2"
                sizes="(max-width: 768px) 80px, 112px"
                unoptimized
              />
            ) : (
              app.icon || "🏛️"
            )}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground leading-tight">{app.name}</h1>
              {app.version && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-lg border border-border bg-surface text-xs font-mono text-muted shadow-sm">
                  v{app.version}
                </span>
              )}
              {app.categories?.map(cat => (
                <Chip key={cat} size="sm" variant="soft" color="accent" className="text-[11px] uppercase font-bold tracking-wider">
                  {cat}
                </Chip>
              ))}
              {statusInfo && (
                <Chip
                  size="sm"
                  variant="soft"
                  color={statusInfo.color}
                  className="text-[11px] uppercase font-bold tracking-wider"
                >
                  {statusInfo.label}
                </Chip>
              )}
              {app.isReuse && (
                <Chip size="sm" variant="soft" color="warning" className="text-[11px] uppercase font-bold flex items-center gap-1">
                  <Share2 className="w-3 h-3" />
                  Nachnutzung
                </Chip>
              )}
              {hasRating && (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted bg-surface px-2.5 py-1 rounded-lg border border-border shadow-sm">
                  <Star className="w-4 h-4 fill-gov-gold text-gov-gold" />
                  <span className="font-bold text-foreground">{(app.ratingAvg || 0).toFixed(1)}</span>
                  <span>({app.ratingCount})</span>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-base md:text-md text-muted leading-relaxed max-w-3xl mb-5">{app.description}</p>

            {/* Tags */}
            {app.tags && app.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {app.tags.map(tag => (
                  <Chip key={tag} size="sm" variant="soft" className="text-xs font-medium bg-surface/50 border-border/60">{tag}</Chip>
                ))}
              </div>
            )}

            {/* Quick links */}
            <div className="flex items-center gap-3 flex-wrap">
              {(() => {
                const allDemos = app.liveDemos && app.liveDemos.length > 0
                  ? app.liveDemos
                  : (app.liveUrl ? [{ label: 'Live-Zugang', url: app.liveUrl }] : []);

                if (allDemos.length === 1) {
                  return (
                    <Link
                      href={allDemos[0].url}
                      target="_blank"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {allDemos[0].label}
                    </Link>
                  );
                } else if (allDemos.length > 1) {
                  return (
                    <Dropdown>
                      <Dropdown.Trigger>
                        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm outline-none">
                          <ExternalLink className="w-4 h-4" />
                          Live-Zugänge ({allDemos.length})
                        </button>
                      </Dropdown.Trigger>
                      <Dropdown.Popover>
                        <Dropdown.Menu 
                          aria-label="Links zu Live-Zugängen"
                          onAction={(key) => {
                            const idx = parseInt(key.toString().replace('demo-', ''));
                            if (!isNaN(idx)) window.open(allDemos[idx].url, '_blank');
                          }}
                        >
                          {allDemos.map((demo, idx) => (
                            <Dropdown.Item 
                              key={idx} 
                              id={`demo-${idx}`} 
                              textValue={demo.label}
                            >
                              <div className="flex items-center gap-2">
                                <ExternalLink className="w-3 h-3" />
                                <span>{demo.label}</span>
                              </div>
                            </Dropdown.Item>
                          ))}
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  );
                }
                return null;
              })()}
              {repositories.map((repo, idx) => (
                <Link
                  key={`${repo.url}-${idx}`}
                  href={repo.url}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground hover:bg-surface-secondary transition-colors shadow-sm"
                >
                  <Github className="w-4 h-4" />
                  {repo.label || 'Quellcode'}
                </Link>
              ))}
              {customLinks.map((customLink, idx) => (
                <Link
                  key={`${customLink.url}-${idx}`}
                  href={customLink.url}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground hover:bg-surface-secondary transition-colors shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  {customLink.label || 'Link'}
                </Link>
              ))}
              {app.docsUrl && (
                <Link
                  href={app.docsUrl}
                  target="_blank"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-foreground hover:bg-surface-secondary transition-colors shadow-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  Dokumentation
                </Link>
              )}
              {app.license && (
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface border border-border text-sm font-medium text-muted cursor-default shadow-sm">
                      <Scale className="w-4 h-4" />
                      {app.license}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Lizenz</Tooltip.Content>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Technik-Streifen (if available) ── */}
      {app.techStack && app.techStack.length > 0 && (
        <div className="flex items-center gap-4 mb-8 overflow-x-auto bg-surface-secondary/50 p-4 rounded-2xl border border-border">
          <span className="text-xs text-muted uppercase tracking-wider font-bold shrink-0 flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            Technik
          </span>
          <div className="flex gap-2 flex-wrap">
            {app.techStack.map((tech: string) => (
              <Chip key={tech} size="sm" variant="soft" className="text-xs font-medium bg-surface border border-border shadow-sm">{tech}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* ── Reuse info box ── */}
      {app.isReuse && (
        <div className="mb-8 p-6 rounded-2xl bg-warning/5 border border-warning/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Share2 className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground mb-1">Nachnutzung</h3>
              <p className="text-sm text-muted mb-3">
                Diese App kann als bestehende Installation mitgenutzt werden. Falls vorhanden, finden Sie zusätzlich unten technische Installationsanleitungen für einen Eigenbetrieb.
              </p>
              {app.reuseRequirements && (
                <div className="mt-3 p-4 rounded-xl bg-surface border border-border">
                  <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Voraussetzungen zur Nachnutzung</h4>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{app.reuseRequirements}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Tabbed content ── */}
      <Tabs variant="secondary" className="w-full">
        <Tabs.ListContainer className="border-b border-border mb-6">
          <Tabs.List aria-label="App-Details Bereiche" className="gap-8">
            <Tabs.Tab id="docs" className="gap-2 py-3 text-sm font-semibold">
              <BookOpen className="w-4 h-4" />
              Dokumentation
              <Tabs.Indicator />
            </Tabs.Tab>
            {metaFields.length > 0 && (
              <Tabs.Tab id="details" className="gap-2 py-3 text-sm font-semibold">
                <Layers className="w-4 h-4" />
                Fachliche Details
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {app.hasDeploymentAssistant !== false && (
              <Tabs.Tab id="deployment" className="gap-2 py-3 text-sm font-semibold">
                <Server className="w-4 h-4" />
                Deployment
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            <Tabs.Tab id="ratings" className="gap-2 py-3 text-sm font-semibold">
              <Star className="w-4 h-4" />
              Bewertungen
              {hasRating && (
                <span className="text-[10px] bg-surface border border-border rounded-full px-2 py-0.5 font-bold shadow-sm">{app.ratingCount}</span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
            {app.changelog && (
              <Tabs.Tab id="changelog" className="gap-2 py-3 text-sm font-semibold whitespace-nowrap">
                <History className="w-4 h-4" />
                Änderungsprotokoll
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {(app.relatedApps && app.relatedApps.length > 0) && (
              <Tabs.Tab id="related" className="gap-2 py-3 text-sm font-semibold whitespace-nowrap">
                <Link2 className="w-4 h-4" />
                Verwandte Apps
                <span className="text-[10px] bg-surface border border-border rounded-full px-2 py-0.5 font-bold shadow-sm">{app.relatedApps.length}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>

        {/* Dokumentation */}
        <Tabs.Panel id="docs">
          <div className="prose prose-bund max-w-none min-h-[300px]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        </Tabs.Panel>

        {/* Fachliche Details */}
        {metaFields.length > 0 && (
          <Tabs.Panel id="details">
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {metaFields.map(f => (
                <MetaCard key={f.label} label={f.label} value={f.value} icon={f.icon} />
              ))}
            </dl>
          </Tabs.Panel>
        )}

        {/* Deployment */}
        {app.hasDeploymentAssistant !== false && (
          <Tabs.Panel id="deployment">
            <DeploymentAssistant app={app} />
          </Tabs.Panel>
        )}

        {/* Bewertungen */}
        <Tabs.Panel id="ratings">
          <RatingSection appId={app.id} />
        </Tabs.Panel>

        {/* Änderungsprotokoll */}
        {app.changelog && (
          <Tabs.Panel id="changelog">
            <div className="prose prose-bund max-w-none min-h-[200px]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{app.changelog}</ReactMarkdown>
            </div>
          </Tabs.Panel>
        )}

        {/* Verwandte Apps */}
        {app.relatedApps && app.relatedApps.length > 0 && (
          <Tabs.Panel id="related">
            <div className="flex flex-col gap-4">
              {app.appGroups && app.appGroups.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {app.appGroups.map(g => (
                    <Chip key={g.id} size="sm" variant="soft" color="accent" className="text-xs font-semibold">
                      {g.name}
                    </Chip>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {app.relatedApps.map(related => (
                  <NextLink
                    key={related.id}
                    href={`/apps/${related.id}`}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-surface-secondary border border-border hover:border-accent/40 hover:bg-surface transition-all shadow-sm group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface border border-border shadow-sm flex items-center justify-center text-xl shrink-0 overflow-hidden">
                      {related.icon?.startsWith('http') ? (
                        <Image
                          src={related.icon}
                          alt={related.name}
                          width={40}
                          height={40}
                          className="object-contain p-1"
                          unoptimized
                        />
                      ) : (
                        related.icon || "🏛️"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate group-hover:text-accent transition-colors">{related.name}</p>
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Link2 className="w-3 h-3" /> {related.id}
                      </p>
                    </div>
                  </NextLink>
                ))}
              </div>
            </div>
          </Tabs.Panel>
        )}
      </Tabs>

      {/* ── Footer meta ── */}
      <div className="mt-12 pt-4 border-t border-separator flex items-center justify-between text-[11px] text-muted">
        <span>ID: <code className="font-mono">{app.id}</code></span>
        <span>
          Aktualisiert: {app.updatedAt ? new Date(app.updatedAt).toLocaleDateString('de-DE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
          }) : '—'}
        </span>
      </div>
    </div>
  );
}
