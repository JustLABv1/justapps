'use client';

import { AppConfig } from "@/config/apps";
import { Button, Card, Chip, Dropdown, Label, Link, Tooltip } from "@heroui/react";
import { BookOpen, Check, ChevronDown, ExternalLink, Github, Star } from "lucide-react";
import NextLink from "next/link";
import { useState } from "react";

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

export function AppCard({ app }: { app: AppConfig }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const hasMultipleRepos = (app.repoUrl ? 1 : 0) + (app.helmRepo ? 1 : 0) + (app.dockerRepo ? 1 : 0) > 1;

  const handleRepoAction = (key: string | number) => {
    if (key === 'repo' && app.repoUrl) window.open(app.repoUrl, '_blank');
    if (key === 'helm' && app.helmRepo) window.open(app.helmRepo, '_blank');
    if (key === 'docker' && app.dockerRepo) window.open(app.dockerRepo, '_blank');
  };

  return (
    <Card className="w-full h-full flex flex-col" variant="default">
      <Card.Header className="flex flex-row items-center gap-4 p-6 pb-2">
        <div className="w-12 h-12 rounded-xl bg-surface-secondary flex items-center justify-center text-2xl border border-border">
          {app.icon || "🏛️"}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <Card.Title className="text-lg font-bold text-foreground leading-tight">{app.name}</Card.Title>
            {app.isFeatured && (
              <Chip size="sm" color="accent" variant="soft" className="h-5 text-[10px] font-bold uppercase py-0 border-none">Curated</Chip>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Card.Description className="text-xs font-semibold text-bund-blue dark:text-bund-gold uppercase tracking-wider">{app.category}</Card.Description>
            {app.ratingCount !== undefined && app.ratingCount > 0 && (
              <div className="flex items-center gap-1 ml-2">
                <Star className="w-3 h-3 fill-bund-gold text-bund-gold" />
                <span className="text-[10px] font-bold text-muted">{(app.ratingAvg || 0).toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </Card.Header>

      <Card.Content className="px-6 py-4 flex-grow">
        <p className="text-sm text-muted leading-relaxed mb-4 line-clamp-3">
          {app.description}
        </p>

        {app.tags && app.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {app.tags.map(tag => (
              <Chip key={tag} size="sm" variant="secondary" className="h-5 text-[9px] font-bold uppercase py-0">{tag}</Chip>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-auto min-h-[40px]">
          {app.liveUrl && (
            <Chip size="sm" variant="soft" color="accent" className="font-bold border-none text-[10px] uppercase">
              Live Demo
            </Chip>
          )}
          {app.helmRepo && (
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button 
                  size="sm" 
                  variant="tertiary"
                  className="h-7 px-2 min-w-0 bg-surface-secondary hover:bg-default text-muted rounded-md gap-1.5"
                  onPress={() => {
                    copyToClipboard(`helm pull ${app.helmRepo}`, 'helm');
                  }}
                >
                  <HelmIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">
                    {copied === 'helm' ? "COPIED" : "HELM"}
                  </span>
                  {copied === 'helm' && <Check className="w-3 h-3 text-success" />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">
                Copy Helm Pull Command
              </Tooltip.Content>
            </Tooltip>
          )}
          {app.dockerRepo && (
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button 
                  size="sm" 
                  variant="tertiary"
                  className="h-7 px-2 min-w-0 bg-surface-secondary hover:bg-default text-muted rounded-md gap-1.5"
                  onPress={() => {
                    copyToClipboard(`docker pull ${app.dockerRepo}`, 'docker');
                  }}
                >
                  <DockerIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold">
                    {copied === 'docker' ? "COPIED" : "DOCKER"}
                  </span>
                  {copied === 'docker' && <Check className="w-3 h-3 text-success" />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">
                Copy Docker Pull Command
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="px-6 pb-6 pt-2">
        <div className="flex flex-col gap-3 w-full">
          <div className={app.liveUrl ? "grid grid-cols-2 gap-3 w-full" : "w-full"}>
            {app.liveUrl && (
              <Link 
                href={app.liveUrl} 
                target="_blank"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 bg-bund-blue text-white hover:bg-bund-blue/90 dark:bg-bund-gold dark:text-bund-black dark:hover:bg-bund-gold/90 no-underline transition-all shadow-sm active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Besuchen
              </Link>
            )}
            <NextLink 
              href={`/apps/${app.id}`} 
              className={`inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 border border-border bg-surface hover:bg-surface-secondary no-underline text-foreground transition-all shadow-sm active:scale-95 ${!app.liveUrl ? 'w-full' : ''}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Details
            </NextLink>
          </div>
          
          {(app.repoUrl || app.helmRepo || app.dockerRepo) && (
            <div className="w-full">
              {hasMultipleRepos ? (
                <Dropdown>
                  <Dropdown.Trigger className="w-full">
                    <Button 
                      variant="secondary" 
                      className="w-full h-10 text-xs font-bold gap-2 rounded-lg border border-border bg-background hover:bg-surface-secondary transition-all shadow-sm"
                    >
                      <Github className="w-3.5 h-3.5" />
                      Source & Repository
                      <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                    </Button>
                  </Dropdown.Trigger>
                  <Dropdown.Popover className="min-w-[200px]">
                    <Dropdown.Menu onAction={handleRepoAction}>
                      {app.repoUrl && (
                        <Dropdown.Item id="repo" textValue="Git Repository">
                          <Github className="w-4 h-4 text-muted" />
                          <Label className="flex-grow">Git Repository</Label>
                        </Dropdown.Item>
                      )}
                      {app.helmRepo && (
                        <Dropdown.Item id="helm" textValue="Helm Chart Repository">
                          <HelmIcon className="w-4 h-4 text-bund-blue" />
                          <Label className="flex-grow">Helm Chart</Label>
                        </Dropdown.Item>
                      )}
                      {app.dockerRepo && (
                        <Dropdown.Item id="docker" textValue="Docker Image Registry">
                          <DockerIcon className="w-4 h-4 text-[#2496ED]" />
                          <Label className="flex-grow">Docker Registry</Label>
                        </Dropdown.Item>
                      )}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : (
                <Link 
                  href={app.repoUrl || app.helmRepo || app.dockerRepo} 
                  target="_blank"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 border border-border bg-background hover:bg-surface-secondary no-underline text-foreground transition-all shadow-sm active:scale-95"
                >
                  {app.repoUrl ? <Github className="w-3.5 h-3.5" /> : app.helmRepo ? <HelmIcon className="w-3.5 h-3.5 text-bund-blue" /> : <DockerIcon className="w-3.5 h-3.5 text-[#2496ED]" />}
                  {app.repoUrl ? "Repository" : app.helmRepo ? "Helm Chart" : "Docker Registry"}
                </Link>
              )}
            </div>
          )}
        </div>
      </Card.Footer>
    </Card>
  );
}
