'use client';

import { Card, CardHeader, CardContent, CardFooter, Separator, Link, Chip, CardTitle, CardDescription, Button, Tooltip, Dropdown, Label } from "@heroui/react";
import { AppConfig } from "@/config/apps";
import { ExternalLink, BookOpen, Check, Github, ChevronDown, Layers, Scale } from "lucide-react";
import { useState } from "react";
import NextLink from "next/link";

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
    <Card className="w-full h-full flex flex-col hover:shadow-lg transition-shadow duration-300" variant="default">
      <CardHeader className="flex flex-row items-center gap-4 p-6">
        <div className="w-12 h-12 rounded-xl bg-bund-light-blue flex items-center justify-center text-2xl shadow-inner">
          {app.icon || "🏛️"}
        </div>
        <div className="flex flex-col">
          <CardTitle className="text-lg font-bold text-bund-black leading-tight">{app.name}</CardTitle>
          <CardDescription className="text-xs font-semibold text-bund-blue uppercase tracking-wider">{app.category}</CardDescription>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="p-6 flex-grow">
        <p className="text-sm text-default-600 leading-relaxed mb-4 line-clamp-3">
          {app.description}
        </p>

        <div className="flex flex-col gap-2 mb-6">
          {app.techStack && (
            <div className="flex items-start gap-2">
              <Layers className="w-3.5 h-3.5 text-default-400 mt-0.5 flex-shrink-0" />
              <div className="flex flex-wrap gap-1">
                {app.techStack.map(tech => (
                  <span key={tech} className="text-[10px] px-1.5 py-0.5 bg-default-100 text-default-600 rounded border border-default-200">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
          {app.license && (
            <div className="flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-default-400 flex-shrink-0" />
              <span className="text-[10px] text-default-500 font-medium truncate">
                {app.license}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mt-auto">
          {app.liveUrl && (
            <Chip size="sm" variant="soft" color="accent" className="font-medium">Live Demo</Chip>
          )}
          {app.helmRepo && (
            <Tooltip delay={0}>
              <Chip 
                size="sm" 
                variant="soft" 
                color="default"
                className="cursor-pointer hover:bg-default-200 transition-colors"
                onPress={(e) => {
                  copyToClipboard(`helm pull ${app.helmRepo}`, 'helm');
                }}
              >
                <HelmIcon className="w-3 h-3" />
                {copied === 'helm' ? <Check className="w-3 h-3 text-success" /> : "Helm"}
              </Chip>
              <Tooltip.Content placement="bottom">
                Copy Helm Pull Command
              </Tooltip.Content>
            </Tooltip>
          )}
              </Tooltip.Content>
            </Tooltip>
          )}
          {app.dockerRepo && (
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Chip 
                  size="sm" 
                  variant="soft" 
                  color="warning"
                  className="cursor-pointer hover:bg-warning-200 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(`docker pull ${app.dockerRepo}`, 'docker');
                  }}
                >
                  <DockerIcon className="w-3 h-3" />
                  {copied === 'docker' ? <Check className="w-3 h-3 text-success" /> : "Docker"}
                </Chip>
              </Tooltip.Trigger>
              <Tooltip.Content placement="bottom">
                Copy Docker Pull Command
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </CardContent>
      <Separator />
      <CardFooter className="p-4 bg-default-50/30">
        <div className="flex flex-col gap-3 w-full">
          <div className="grid grid-cols-2 gap-3 w-full">
            {app.liveUrl && (
              <Link 
                href={app.liveUrl} 
                target="_blank"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 bg-bund-blue text-white hover:bg-bund-blue/90 no-underline transition-all shadow-sm active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Besuchen
              </Link>
            )}
            <NextLink 
              href={`/apps/${app.id}`} 
              className="inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 border border-default-300 bg-white hover:bg-default-50 no-underline text-default-700 transition-all shadow-sm active:scale-95"
            >
              <BookOpen className="w-3.5 h-3.5" />
              Details
            </NextLink>
          </div>
          
          {(app.repoUrl || app.helmRepo || app.dockerRepo) && (
            <div className="w-full">
              {hasMultipleRepos ? (
                <Dropdown>
                  <Dropdown.Trigger>
                    <Button 
                      variant="secondary" 
                      className="w-full h-10 text-xs font-bold gap-2 rounded-lg border border-default-300 bg-white hover:bg-default-50 transition-all shadow-sm"
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
                          <Github className="w-4 h-4 text-default-500" />
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
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg text-xs font-bold h-10 px-4 border border-default-300 bg-white hover:bg-default-50 no-underline text-default-700 transition-all shadow-sm active:scale-95"
                >
                  <Github className="w-3.5 h-3.5" />
                  Code Repository
                </Link>
              )}
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
