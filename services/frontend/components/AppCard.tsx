'use client';

import { AppConfig } from "@/config/apps";
import { Card, Chip, Dropdown, Link, Tooltip } from "@heroui/react";
import { AlertTriangle, BookOpen, Clock, ExternalLink, Github, Landmark, Star } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { useState } from "react";

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
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;
  const [now] = useState(() => Date.now());

  const getStatusProps = (state?: string) => {
    switch (state?.toLowerCase()) {
      case 'etabliert':
      case 'produktiv':
      case 'graduated':
        return { color: 'success' as const, label: 'Etabliert' };
      case 'in erprobung':
      case 'in inkubation':
      case 'incubating':
        return { color: 'accent' as const, label: 'In Erprobung' };
      case 'sandbox':
        return { color: 'warning' as const, label: 'Sandbox' };
      case 'mvp':
        return { color: 'default' as const, label: 'MVP' };
      case 'poc':
        return { color: 'default' as const, label: 'POC' };
      default:
        return state ? { color: 'default' as const, label: state } : null;
    }
  };

  const statusInfo = getStatusProps(app.status);
  const isFeatured = app.isFeatured;

  const relativeTime = getRelativeTime(app.updatedAt, now);

  const allDemos = app.liveDemos && app.liveDemos.length > 0 
    ? app.liveDemos 
    : (app.liveUrl ? [{ label: 'Live Demo', url: app.liveUrl }] : []);
  const repositories = app.repositories && app.repositories.length > 0
    ? app.repositories
    : (app.repoUrl ? [{ label: 'Repository', url: app.repoUrl }] : []);
  const customLinks = app.customLinks || [];

  return (
    <Card 
      className={`w-full flex flex-col group transition-all duration-500 hover:shadow-xl hover:-translate-y-1.5 bg-surface overflow-visible p-0 
        ${isFeatured 
          ? 'border-accent/50 shadow-lg shadow-accent/10 bg-gradient-to-br from-surface via-surface to-accent/[0.06] scale-[1.02] z-10' 
          : 'hover:border-accent/40 border-border'
        }`} 
      variant="default"
    >
      {isFeatured && (
        <div className="absolute -top-3 -right-3 z-20 flex items-center justify-center p-2 rounded-full bg-gov-gold shadow-lg shadow-gov-gold/30 animate-in zoom-in-50 duration-500">
          <Star className="w-4 h-4 text-white fill-white" />
        </div>
      )}
      {app.knownIssue && (
        <Tooltip delay={0}>
          <Tooltip.Trigger>
            <div className={`absolute z-20 flex items-center justify-center w-7 h-7 rounded-full bg-warning shadow-md shadow-warning/30 cursor-help ${isFeatured ? '-top-3 right-8' : '-top-2 -right-2'}`}>
              <AlertTriangle className="w-3.5 h-3.5 text-white" />
            </div>
          </Tooltip.Trigger>
          <Tooltip.Content className="max-w-64">
            <p className="text-xs font-bold mb-1">Bekanntes Problem</p>
            <p className="text-xs">{app.knownIssue}</p>
          </Tooltip.Content>
        </Tooltip>
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
          <div className="flex items-center gap-2 mb-1">
            <Card.Title className={`text-lg font-bold leading-tight truncate transition-colors ${isFeatured ? 'text-accent' : 'text-foreground group-hover:text-accent'}`}>
              {app.name}
            </Card.Title>
            {app.isReuse && (
              <Chip size="sm" color="warning" variant="soft" className="text-[10px] h-4 font-black uppercase tracking-widest shrink-0 px-2">
                Nachnutzung
              </Chip>
            )}
            {isFeatured && (
              <Chip size="sm" color="accent" variant="soft" className="text-[10px] h-4 font-black uppercase tracking-widest shrink-0 px-2 shadow-md shadow-accent/20 animate-pulse">
                Ausgezeichnet
              </Chip>
            )}
            {relativeTime?.isRecent && !isFeatured && (
              <Chip size="sm" color="success" variant="soft" className="text-[10px] h-4 font-black uppercase tracking-widest shrink-0 px-2">
                Neu
              </Chip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Status:</span>
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
          {relativeTime && (
            <div className="flex items-center gap-2 text-muted/70">
              <Clock className="w-3 h-3" />
              <span className="text-[11px]">{relativeTime.label}</span>
            </div>
          )}
        </div>
      </Card.Content>

      {/* ── Footer: primary action + quick-links ── */}
      <Card.Footer className="p-0 mt-auto bg-surface-secondary/30 border-t border-border/50 group-hover:bg-accent/5 transition-colors overflow-hidden">
        <div className="flex items-center justify-between w-full px-6 py-4">
          {/* Primary action */}
          <NextLink
            href={`/apps/${app.id}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-foreground group-hover:text-accent transition-colors"
          >
            Details ansehen
            <ExternalLink className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </NextLink>

          {/* Quick-links */}
          <div className="flex items-center gap-1.5">
            {allDemos.length === 1 && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={allDemos[0].url}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm"
                    aria-label={`${allDemos[0].label} öffnen`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">{allDemos[0].label}</Tooltip.Content>
              </Tooltip>
            )}

            {allDemos.length > 1 && (
              <Dropdown>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Dropdown.Trigger
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm outline-none"
                      aria-label="Live Demos anzeigen"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Dropdown.Trigger>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="bottom">Live Demos</Tooltip.Content>
                </Tooltip>
                <Dropdown.Popover>
                  <Dropdown.Menu 
                    aria-label="Live Demo Links"
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
            )}

            {repositories.length === 1 && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={repositories[0].url}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm"
                    aria-label="Repository öffnen"
                  >
                    <Github className="w-3.5 h-3.5" />
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">{repositories[0].label || 'Repository'}</Tooltip.Content>
              </Tooltip>
            )}

            {repositories.length > 1 && (
              <Dropdown>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Dropdown.Trigger
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm outline-none"
                      aria-label="Repositories anzeigen"
                    >
                      <Github className="w-3.5 h-3.5" />
                    </Dropdown.Trigger>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="bottom">Repositories</Tooltip.Content>
                </Tooltip>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="Repository Links"
                    onAction={(key) => {
                      const idx = parseInt(key.toString().replace('repo-', ''));
                      if (!isNaN(idx)) window.open(repositories[idx].url, '_blank');
                    }}
                  >
                    {repositories.map((repo, idx) => (
                      <Dropdown.Item
                        key={idx}
                        id={`repo-${idx}`}
                        textValue={repo.label || 'Repository'}
                      >
                        <div className="flex items-center gap-2">
                          <Github className="w-3 h-3" />
                          <span>{repo.label || 'Repository'}</span>
                        </div>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}

            {customLinks.length > 0 && (
              <Dropdown>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Dropdown.Trigger
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm outline-none"
                      aria-label="Links anzeigen"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Dropdown.Trigger>
                  </Tooltip.Trigger>
                  <Tooltip.Content placement="bottom">Links</Tooltip.Content>
                </Tooltip>
                <Dropdown.Popover>
                  <Dropdown.Menu
                    aria-label="Links"
                    onAction={(key) => {
                      const idx = parseInt(key.toString().replace('custom-', ''));
                      if (!isNaN(idx)) window.open(customLinks[idx].url, '_blank');
                    }}
                  >
                    {customLinks.map((customLink, idx) => (
                      <Dropdown.Item
                        key={idx}
                        id={`custom-${idx}`}
                        textValue={customLink.label || 'Link'}
                      >
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-3 h-3" />
                          <span>{customLink.label || 'Link'}</span>
                        </div>
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown.Popover>
              </Dropdown>
            )}
            {app.docsUrl && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={app.docsUrl}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-accent hover:border-accent/30 hover:bg-accent/10 transition-all shadow-sm outline-none"
                    aria-label="Dokumentation öffnen"
                  >
                    <BookOpen className="w-4 h-4" />
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">Dokumentation</Tooltip.Content>
              </Tooltip>
            )}
          </div>
        </div>
      </Card.Footer>
    </Card>
  );
}
