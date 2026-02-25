'use client';

import { AppConfig } from "@/config/apps";
import { Card, Chip, Dropdown, Link, Tooltip } from "@heroui/react";
import { BookOpen, ExternalLink, Github, Star } from "lucide-react";
import NextLink from "next/link";

export function AppCard({ app }: { app: AppConfig }) {
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;

  const getStatusProps = (state?: string) => {
    switch (state?.toLowerCase()) {
      case 'graduated':
        return { color: 'success' as const, label: 'Produktiv' };
      case 'incubating':
        return { color: 'accent' as const, label: 'In Inkubation' };
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

  const allDemos = app.liveDemos && app.liveDemos.length > 0 
    ? app.liveDemos 
    : (app.liveUrl ? [{ label: 'Live Demo', url: app.liveUrl }] : []);

  return (
    <Card className="w-full h-full flex flex-col group" variant="default">
      {/* ── Header: icon, name, badge ── */}
      <Card.Header className="p-5 pb-0 flex flex-row items-start gap-3">
        <div className="w-11 h-11 rounded-lg bg-default flex items-center justify-center text-xl shrink-0 overflow-hidden">
          {app.icon?.startsWith('http') ? (
            <img src={app.icon} alt={app.name} className="w-full h-full object-cover" />
          ) : (
            app.icon || "🏛️"
          )}
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Card.Title className="text-base font-semibold text-foreground leading-tight truncate">
              {app.name}
            </Card.Title>
            {app.isFeatured && (
              <Chip size="sm" color="accent" variant="soft" className="text-[10px] font-semibold uppercase shrink-0">
                Curated
              </Chip>
            )}
            {statusInfo && (
              <Chip 
                size="sm" 
                color={statusInfo.color} 
                variant="soft" 
                className="text-[10px] font-semibold uppercase shrink-0"
              >
                {statusInfo.label}
              </Chip>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
            <span className="text-xs font-medium text-accent tracking-wide line-clamp-1">
              {app.categories?.join(', ')}
            </span>
            {hasRating && (
              <>
                <span className="text-muted text-[10px]">·</span>
                <Star className="w-3 h-3 fill-gov-gold text-gov-gold" />
                <span className="text-[11px] font-medium text-muted">
                  {(app.ratingAvg || 0).toFixed(1)}
                </span>
                <span className="text-[10px] text-muted">({app.ratingCount})</span>
              </>
            )}
          </div>
        </div>
      </Card.Header>

      {/* ── Body: description + tags ── */}
      <Card.Content className="px-5 pt-3 pb-4 flex-grow flex flex-col">
        <p className="text-sm text-muted leading-relaxed line-clamp-3">
          {app.description}
        </p>

        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {app.tags.map(tag => (
              <Chip key={tag} size="sm" variant="secondary" className="text-[10px] font-medium">
                {tag}
              </Chip>
            ))}
          </div>
        )}
      </Card.Content>

      {/* ── Footer: primary action + quick-links ── */}
      <Card.Footer className="px-5 pb-5 pt-0 mt-auto">
        <div className="flex items-center justify-between w-full border-t border-separator pt-3">
          {/* Primary action */}
          <NextLink
            href={`/apps/${app.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline underline-offset-4 transition-colors"
          >
            Details anzeigen
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </NextLink>

          {/* Quick-links */}
          <div className="flex items-center gap-1">
            {allDemos.length === 1 && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={allDemos[0].url}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-accent hover:bg-default transition-colors"
                    aria-label={`${allDemos[0].label} öffnen`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">{allDemos[0].label}</Tooltip.Content>
              </Tooltip>
            )}

            {allDemos.length > 1 && (
              <Dropdown>
                <Tooltip delay={0}>
                  <Tooltip.Trigger>
                    <Dropdown.Trigger>
                      <button
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-accent hover:bg-default transition-colors outline-none"
                        aria-label="Live Demos anzeigen"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
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

            {app.repoUrl && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={app.repoUrl}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-accent hover:bg-default transition-colors"
                    aria-label="Repository öffnen"
                  >
                    <Github className="w-4 h-4" />
                  </Link>
                </Tooltip.Trigger>
                <Tooltip.Content placement="bottom">Repository</Tooltip.Content>
              </Tooltip>
            )}
            {app.docsUrl && (
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Link
                    href={app.docsUrl}
                    target="_blank"
                    className="inline-flex items-center justify-center w-8 h-8 rounded-md text-muted hover:text-accent hover:bg-default transition-colors"
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
