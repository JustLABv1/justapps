'use client';

import { DeploymentAssistant } from "@/components/DeploymentAssistant";
import { RatingSection } from "@/components/RatingSection";
import { AppConfig } from "@/config/apps";
import { useAuth } from "@/context/AuthContext";
import { Chip, Link, Separator, Tabs, Tooltip } from "@heroui/react";
import {
  BookOpen,
  ChevronLeft,
  Database,
  ExternalLink,
  Github,
  Globe,
  Layers,
  LayoutDashboard,
  Loader2,
  Pencil,
  Scale,
  Server,
  Star,
  User,
} from "lucide-react";
import NextLink from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Helper: renders a labelled metadata row ── */
function MetaRow({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
        {icon}
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export default function AppPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const [app, setApp] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

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
      <Loader2 className="w-8 h-8 animate-spin text-accent" />
      <p className="text-muted font-medium">App-Details werden geladen...</p>
    </div>
  );

  if (!app) return notFound();

  const isAdmin = user?.role === 'admin';
  const content = app.markdownContent || `# ${app.name}\n\n${app.description}\n\n*Keine detaillierte Dokumentation verfügbar.*`;
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;

  /* Collect non-empty metadata pairs for the details tab */
  const metaFields: { label: string; value?: string; icon?: React.ReactNode }[] = [
    { label: "Themenfeld", value: app.focus, icon: <Layers className="w-3 h-3" /> },
    { label: "Anwendungstyp", value: app.appType, icon: <Globe className="w-3 h-3" /> },
    { label: "Anwendungsfall", value: app.useCase },
    { label: "Visualisierung", value: app.visualization },
    { label: "Deployment", value: app.deployment, icon: <Server className="w-3 h-3" /> },
    { label: "Infrastruktur", value: app.infrastructure },
    { label: "Datenbasis", value: app.database, icon: <Database className="w-3 h-3" /> },
    { label: "Status", value: app.status },
    { label: "Übertragbarkeit", value: app.transferability },
    { label: "Ansprechpartner", value: app.contactPerson, icon: <User className="w-3 h-3" /> },
    { label: "Sonstiges", value: app.additionalInfo },
  ].filter(f => f.value);

  return (
    <div className="max-w-5xl mx-auto pb-20">

      {/* ── Nav row ── */}
      <div className="flex justify-between items-center mb-6">
        <NextLink href="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Übersicht
        </NextLink>

        {isAdmin && (
          <div className="flex items-center gap-2">
            <NextLink
              href={`/management?edit=${app.id}`}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Bearbeiten
            </NextLink>
            <Separator orientation="vertical" className="h-4" />
            <NextLink
              href="/management"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              Verwaltung
            </NextLink>
          </div>
        )}
      </div>

      {/* ── Hero ── */}
      <header className="mb-8">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-xl bg-default flex items-center justify-center text-3xl shrink-0">
            {app.icon || "🏛️"}
          </div>

          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-bold text-foreground leading-tight">{app.name}</h1>
              <Chip size="sm" variant="soft" color="accent" className="text-[10px] uppercase font-semibold tracking-wider">
                {app.category}
              </Chip>
              {app.status && (
                <Chip
                  size="sm"
                  variant="soft"
                  color={app.status.toLowerCase().includes('produktiv') ? 'success' : 'default'}
                  className="text-[10px] uppercase font-semibold tracking-wider"
                >
                  {app.status}
                </Chip>
              )}
              {app.isFeatured && (
                <Chip size="sm" variant="soft" color="success" className="text-[10px] uppercase font-semibold">
                  Curated
                </Chip>
              )}
              {hasRating && (
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Star className="w-3.5 h-3.5 fill-gov-gold text-gov-gold" />
                  <span className="font-semibold text-foreground">{(app.ratingAvg || 0).toFixed(1)}</span>
                  <span>({app.ratingCount})</span>
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-muted leading-relaxed max-w-2xl mb-3">{app.description}</p>

            {/* Tags */}
            {app.tags && app.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {app.tags.map(tag => (
                  <Chip key={tag} size="sm" variant="secondary" className="text-[10px] font-medium">{tag}</Chip>
                ))}
              </div>
            )}

            {/* Quick links */}
            <div className="flex items-center gap-4 flex-wrap">
              {app.liveUrl && (
                <Link
                  href={app.liveUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline underline-offset-4"
                >
                  <ExternalLink className="w-4 h-4" />
                  Live Demo
                </Link>
              )}
              {app.repoUrl && (
                <Link
                  href={app.repoUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
                >
                  <Github className="w-4 h-4" />
                  Repository
                </Link>
              )}
              {app.docsUrl && (
                <Link
                  href={app.docsUrl}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-accent transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  Dokumentation
                </Link>
              )}
              {app.license && (
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <span className="inline-flex items-center gap-1.5 text-sm text-muted cursor-default">
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

      <Separator className="mb-6" />

      {/* ── Tech stack strip (if available) ── */}
      {app.techStack && app.techStack.length > 0 && (
        <div className="flex items-center gap-3 mb-6 overflow-x-auto">
          <span className="text-[11px] text-muted uppercase tracking-wider font-medium shrink-0">Stack</span>
          <div className="flex gap-1.5 flex-wrap">
            {app.techStack.map((tech: string) => (
              <Chip key={tech} size="sm" variant="secondary" className="text-[10px]">{tech}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabbed content ── */}
      <Tabs variant="secondary" className="w-full">
        <Tabs.ListContainer className="border-b border-border mb-6">
          <Tabs.List aria-label="App-Details Bereiche" className="gap-6">
            <Tabs.Tab id="docs" className="gap-2 py-3 text-sm font-medium">
              <BookOpen className="w-4 h-4" />
              Dokumentation
              <Tabs.Indicator />
            </Tabs.Tab>
            {metaFields.length > 0 && (
              <Tabs.Tab id="details" className="gap-2 py-3 text-sm font-medium">
                <Layers className="w-4 h-4" />
                Fachliche Details
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            <Tabs.Tab id="deployment" className="gap-2 py-3 text-sm font-medium">
              <Server className="w-4 h-4" />
              Deployment
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="ratings" className="gap-2 py-3 text-sm font-medium">
              <Star className="w-4 h-4" />
              Bewertungen
              {hasRating && (
                <span className="text-[10px] bg-default rounded-full px-1.5 py-0.5 font-medium">{app.ratingCount}</span>
              )}
              <Tabs.Indicator />
            </Tabs.Tab>
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
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
              {metaFields.map(f => (
                <MetaRow key={f.label} label={f.label} value={f.value} icon={f.icon} />
              ))}
            </dl>
          </Tabs.Panel>
        )}

        {/* Deployment */}
        <Tabs.Panel id="deployment">
          <DeploymentAssistant app={app} />
        </Tabs.Panel>

        {/* Bewertungen */}
        <Tabs.Panel id="ratings">
          <RatingSection appId={app.id} />
        </Tabs.Panel>
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
