'use client';

import { AppConfig } from "@/config/apps";
import { useSettings } from "@/context/SettingsContext";
import { useUpdates } from "@/context/UpdatesContext";
import { getAppFreshness } from "@/lib/appFreshness";
import { getAppStatusMeta } from "@/lib/appStatus";
import { getImageAssetUrl } from "@/lib/assets";
import { Badge, type BadgeVariant } from "@/components/panelui/badge";
import { Button } from "@/components/panelui/button";
import { Card } from "@/components/panelui/card";
import { Menu } from "@/components/panelui/menu";
import { BookOpen, Clock, ExternalLink, Landmark, MoreHorizontal, Star } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FavoriteButton } from "./FavoriteButton";
import { GitHubIcon } from "./GitHubIcon";
import { LinkStatusDot } from "./LinkStatusDot";

const BADGE_VARIANT: Record<'default' | 'accent' | 'success' | 'warning', BadgeVariant> = {
  default: 'secondary',
  accent: 'info',
  success: 'success',
  warning: 'warning',
};

export function AppCard({ app }: { app: AppConfig }) {
  const router = useRouter();
  const { settings } = useSettings();
  const { appUnreadCounts } = useUpdates();
  const probeEnabled = settings.enableLinkProbing && !app.skipLinkProbe;
  const probeStatus = probeEnabled ? app.linkProbeStatus : undefined;
  const hasRating = app.ratingCount !== undefined && app.ratingCount > 0;
  const [now] = useState(() => Date.now());
  const statusInfo = getAppStatusMeta(app.status);
  const iconSrc = getImageAssetUrl(app.icon);
  const isFeatured = app.isFeatured;
  const freshness = getAppFreshness(app, now);
  const relativeTime = freshness.updatedRelative ?? freshness.createdRelative;

  const allDemos = app.liveDemos && app.liveDemos.length > 0
    ? app.liveDemos
    : (app.liveUrl ? [{ label: 'Live-Zugang', url: app.liveUrl }] : []);
  const repositories = app.repositories && app.repositories.length > 0
    ? app.repositories
    : (app.repoUrl ? [{ label: 'Quellcode', url: app.repoUrl }] : []);
  const customLinks = app.customLinks || [];
  const resourceItems = [
    ...allDemos.map((link) => ({ ...link, icon: <ExternalLink />, kind: 'demo' })),
    ...repositories.map((link) => ({ ...link, icon: <GitHubIcon />, kind: 'repository' })),
    ...customLinks.map((link) => ({ ...link, icon: <ExternalLink />, kind: 'link' })),
    ...(app.docsUrl ? [{ label: 'Dokumentation', url: app.docsUrl, icon: <BookOpen />, kind: 'docs' }] : []),
  ];
  const spotlightBadge = freshness.badgeLabel;
  const spotlightBadgeColor = freshness.badgeColor;
  const unreadCount = appUnreadCounts[app.id] || 0;

  return (
    <Card
      as="article"
      className="relative h-full cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/apps/${app.id}`)}
    >
      <Card.Header>
        <div className="flex min-w-0 items-start gap-3">
          <div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted text-xl">
            {iconSrc ? (
              <Image src={iconSrc} alt="" fill className="object-contain p-1.5" sizes="44px" unoptimized />
            ) : (
              app.icon || "🏛️"
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <Card.Title className="truncate">{app.name}</Card.Title>
            {app.categories && app.categories.length > 0 && (
              <Card.Description className="truncate">{app.categories.join(", ")}</Card.Description>
            )}
          </div>
        </div>
        {isFeatured && (
          <Card.Action>
            <Badge variant="warning" size="sm">
              <Star className="fill-current" />
              Empfohlen
            </Badge>
          </Card.Action>
        )}
      </Card.Header>

      <Card.Content className="flex flex-1 flex-col gap-4">
        <p className="line-clamp-3 text-sm text-muted-foreground">{app.description}</p>

        <div className="mt-auto flex flex-col gap-3">
          {(statusInfo || spotlightBadge || unreadCount > 0 || hasRating) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {statusInfo && (
                <Badge size="sm" variant={BADGE_VARIANT[statusInfo.color]}>
                  {statusInfo.label}
                </Badge>
              )}
              {spotlightBadge && (
                <Badge size="sm" variant={BADGE_VARIANT[spotlightBadgeColor]}>
                  {spotlightBadge}
                </Badge>
              )}
              {unreadCount > 0 && (
                <Badge size="sm" variant="info" dot>
                  {unreadCount} neu
                </Badge>
              )}
              {hasRating && (
                <Badge size="sm" variant="outline" aria-label={`Bewertung ${(app.ratingAvg || 0).toFixed(1)} von 5`}>
                  <Star className="fill-current" />
                  {(app.ratingAvg || 0).toFixed(1)}
                </Badge>
              )}
            </div>
          )}
          {app.authority && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Landmark className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{app.authority}</span>
            </div>
          )}
        </div>
      </Card.Content>

      <Card.Footer variant="panel" className="justify-between">
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <FavoriteButton appId={app.id} />
          {relativeTime && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {relativeTime.label}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {resourceItems.length === 1 && (
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              render={
                <a
                  href={resourceItems[0].url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${resourceItems[0].label} öffnen`}
                />
              }
            >
              {resourceItems[0].icon}
              {resourceItems[0].label}
              {probeEnabled && resourceItems[0].kind === 'demo' && (
                <LinkStatusDot status={probeStatus} />
              )}
            </Button>
          )}

          {resourceItems.length > 1 && (
            <Menu>
              <Menu.Trigger render={<Button variant="outline" size="sm" shape="pill" />}>
                <MoreHorizontal />
                Schnellzugriff
              </Menu.Trigger>
              <Menu.Content align="end" aria-label="Ressourcen">
                {resourceItems.map((resource, index) => (
                  <Menu.Item
                    key={`${resource.kind}-${index}`}
                    onClick={() => window.open(resource.url, '_blank', 'noopener,noreferrer')}
                  >
                    {resource.icon}
                    {resource.label}
                    {probeEnabled && resource.kind === 'demo' && (
                      <LinkStatusDot status={probeStatus} />
                    )}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
}
