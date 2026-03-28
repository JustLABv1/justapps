'use client';

import { AppConfig } from "@/config/apps";
import { useSettings } from "@/context/SettingsContext";
import { getAppStatusMeta } from "@/lib/appStatus";
import { Button, Card, Chip, Dropdown, Link, Tooltip } from "@heroui/react";
import { AlertTriangle, BookOpen, Clock, ExternalLink, Github, Landmark, MoreHorizontal, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteButton } from "./FavoriteButton";
import { LinkStatusDot } from "./LinkStatusDot";

// Pure helper defined outside component to avoid impurity lint warnings
function getRelativeTime(dateStr: string | undefined, now: number): { label: string; isRecent: boolean } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffMs = now - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: 'Heute', isRecent: true };
  if (diffDays === 1) return { label: 'Gestern', isRecent: true };
  if (diffDays < 7) return { label: `vor ${diffDays} Tagen`, isRecent: true };
  if (diffDays < 30) return { label: `vor ${Math.floor(diffDays / 7)} Woche${Math.floor(diffDays / 7) > 1 ? 'n' : ''}`, isRecent: false };
  if (diffDays < 365) return { label: `vor ${Math.floor(diffDays / 30)} Monat${Math.floor(diffDays / 30) > 1 ? 'en' : ''}`, isRecent: false };
  return { label: `vor ${Math.floor(diffDays / 365)} Jahr${Math.floor(diffDays / 365) > 1 ? 'en' : ''}`, isRecent: false };
}

export function AppCard({ app }: { app: AppConfig }) {
  const router = useRouter();
  const { settings } = useSettings();
  const probeEnabled = settings.enableLinkProbing && !app.skipLinkProbe;
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;
  const [now] = useState(() => Date.now());
  const statusInfo = getAppStatusMeta(app.status);
  const isFeatured = app.isFeatured;

  const relativeTime = getRelativeTime(app.updatedAt, now);

  const allDemos = app.liveDemos && app.liveDemos.length > 0
    ? app.liveDemos
    : (app.liveUrl ? [{ label: 'Live-Zugang', url: app.liveUrl }] : []);
  const repositories = app.repositories && app.repositories.length > 0
    ? app.repositories
    : (app.repoUrl ? [{ label: 'Quellcode', url: app.repoUrl }] : []);
  const customLinks = app.customLinks || [];
  const resourceItems = [
    ...allDemos.map((link) => ({ ...link, icon: <ExternalLink className="w-3 h-3" />, kind: 'demo' })),
    ...repositories.map((link) => ({ ...link, icon: <Github className="w-3 h-3" />, kind: 'repository' })),
    ...customLinks.map((link) => ({ ...link, icon: <ExternalLink className="w-3 h-3" />, kind: 'link' })),
    ...(app.docsUrl ? [{ label: 'Dokumentation', url: app.docsUrl, icon: <BookOpen className="w-3 h-3" />, kind: 'docs' }] : []),
  ];
  const spotlightBadge = app.isReuse ? 'Nachnutzung' : relativeTime?.isRecent ? 'Neu' : null;
  const spotlightBadgeColor = app.isReuse ? 'warning' : 'success';

  return (
    <Card
      className={`relative w-full flex flex-col group transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-surface overflow-visible p-0 cursor-pointer
        ${isFeatured
          ? 'border-accent/45 shadow-lg shadow-accent/10 bg-gradient-to-br from-surface via-surface to-accent/[0.04] z-10'
          : 'hover:border-accent/40 border-border'
        }`}
      variant="default"
      onClick={() => router.push(`/apps/${app.id}`)}
    >
      {isFeatured && (
        <div className="absolute -top-3 -right-3 z-20 flex items-center justify-center rounded-full bg-gov-gold p-2 shadow-lg shadow-gov-gold/20">
          <Star className="w-3.5 h-3.5 text-white fill-white" />
        </div>
      )}
      {app.knownIssue && (
        <div className={`absolute z-20 ${isFeatured ? '-top-3 right-8' : '-top-2 -right-2'}`}>
          <Tooltip delay={0}>
            <Tooltip.Trigger aria-label="Bekanntes Problem anzeigen">
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-warning shadow-md shadow-warning/30 cursor-help"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-white" />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Content className="max-w-64" placement="bottom" showArrow>
              <Tooltip.Arrow />
              <p className="text-xs font-bold mb-1">Bekanntes Problem</p>
              <p className="text-xs">{app.knownIssue}</p>
            </Tooltip.Content>
          </Tooltip>
        </div>
      )}
      {/* ── Header: icon, name, badge ── */}
      <Card.Header className="p-6 pb-2 flex flex-row items-start gap-4 ring-offset-background">
        <div className={`relative w-14 h-14 rounded-2xl border flex items-center justify-center text-2xl shrink-0 transition-all duration-300 group-hover:scale-110
          ${isFeatured 
            ? 'bg-gradient-to-br from-accent/30 to-accent/5 border-accent/40 shadow-inner' 
            : 'bg-gradient-to-br from-surface-secondary to-surface border-border'
          }`}>
          {app.icon?.startsWith('http') ? (
            <Image 
              src={app.icon} 
              alt={app.name} 
              fill
              className="object-contain p-2"
              sizes="56px"
              unoptimized
            />
          ) : (
            app.icon || "🏛️"
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Card.Title className={`text-lg font-bold leading-tight truncate transition-colors ${isFeatured ? 'text-accent' : 'text-foreground group-hover:text-accent'}`}>
              {app.name}
            </Card.Title>
            {spotlightBadge && (
              <Chip size="sm" color={spotlightBadgeColor as 'warning' | 'success'} variant="soft" className="h-5 shrink-0 px-2 text-[10px] font-bold uppercase tracking-[0.16em]">
                {spotlightBadge}
              </Chip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-muted">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider line-clamp-1">
              {app.categories?.join(', ')}
            </span>
            {hasRating && (
              <>
                <span className="text-muted/30 text-[10px]">|</span>
                <div className="flex items-center gap-1 bg-gov-gold/10 px-1.5 py-0.5 rounded text-gov-gold">
                  <Star className="w-3 h-3 fill-current" />
                  <span className="text-[11px] font-bold">
                    {(app.ratingAvg || 0).toFixed(1)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </Card.Header>

      {/* ── Body: description + tags ── */}
      <Card.Content className="px-6 pt-3 pb-5 flex-grow flex flex-col">
        <p className="text-sm text-muted leading-relaxed line-clamp-3 mb-4">
          {app.description}
        </p>

        <div className="mt-auto flex flex-col gap-3">
          {statusInfo && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Status</span>
              <Chip 
                size="sm" 
                color={statusInfo.color} 
                variant="soft" 
                className="text-[10px] font-bold uppercase h-5"
              >
                {statusInfo.label}
              </Chip>
            </div>
          )}
          {app.authority && (
            <div className="flex items-center gap-2 text-muted">
              <Landmark className="w-3.5 h-3.5" />
              <span className="text-xs line-clamp-1">{app.authority}</span>
            </div>
          )}
        </div>
      </Card.Content>

      {/* ── Footer: primary action + quick-links ── */}
      <Card.Footer className="mt-auto overflow-hidden border-t border-border/50 bg-surface-secondary/30 p-0 transition-colors group-hover:bg-accent/5">
        <div className="flex items-center justify-between w-full px-6 py-4">
          {/* Favorite + timestamp */}
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <FavoriteButton appId={app.id} />
            {relativeTime && (
              <div className="flex items-center gap-1.5 text-muted/60">
                <Clock className="w-3 h-3" />
                <span className="text-[11px]">{relativeTime.label}</span>
              </div>
            )}
          </div>

          {/* Quick-links */}
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {resourceItems.length === 1 && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={resourceItems[0].url}
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-sm transition-all hover:border-accent/30 hover:bg-accent/10 hover:text-accent"
                    aria-label={`${resourceItems[0].label} öffnen`}
                  >
                    {resourceItems[0].icon}
                    {resourceItems[0].label}
                    {probeEnabled && resourceItems[0].kind === 'demo' && (
                      <LinkStatusDot url={resourceItems[0].url} />
                    )}
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">Direktzugriff</Tooltip.Content>
              </Tooltip>
            )}

            {resourceItems.length > 1 && (
              <Dropdown>
                <Dropdown.Trigger>
                  <Button size="sm" variant="secondary" className="gap-2 rounded-full px-3 text-xs font-semibold">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    Schnellzugriff
                  </Button>
                </Dropdown.Trigger>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="Ressourcen"
                    onAction={(key) => {
                      const index = parseInt(key.toString().replace('resource-', ''), 10);
                      if (!Number.isNaN(index)) window.open(resourceItems[index].url, '_blank');
                    }}
                  >
                    {resourceItems.map((resource, index) => (
                      <Dropdown.Item key={`${resource.kind}-${index}`} id={`resource-${index}`} textValue={resource.label}>
                        <div className="flex items-center gap-2">
                          {resource.icon}
                          <span>{resource.label}</span>
                          {probeEnabled && resource.kind === 'demo' && (
                            <LinkStatusDot url={resource.url} />
                          )}
                        </div>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}
          </div>
        </div>
      </Card.Footer>
    </Card>
  );
}
