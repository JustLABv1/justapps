"use client";

import { AppConfig } from '@/config/apps';
import { Button, Tabs } from '@heroui/react';
import { Box, Check, Copy, Ship, Terminal } from 'lucide-react';
import React, { useState } from 'react';

interface DeploymentAssistantProps {
  app: AppConfig;
}

export const DeploymentAssistant: React.FC<DeploymentAssistantProps> = ({ app }) => {
  const [copied, setCopied] = useState(false);

  const dockerCommand = app.customDockerCommand || `docker run -d \\
  --name ${app.id} \\
  -p 8080:80 \\
  ${app.dockerRepo || `ghcr.io/bund/${app.id}:latest`}`;

  const dockerCompose = app.customComposeCommand || `services:
  ${app.id}:
    image: ${app.dockerRepo || `ghcr.io/bund/${app.id}:latest`}
    ports:
      - "8080:80"
    restart: always`;

  const helmCommand = app.customHelmCommand || `helm repo add bund ${app.helmRepo || 'https://charts.bund.de'}
helm install ${app.id} bund/${app.id}`;

  const showDocker = app.showDocker !== false;
  const showCompose = app.showCompose !== false;
  const showHelm = app.showHelm !== false;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!showDocker && !showCompose && !showHelm) {
    return null;
  }

  return (
    <div className="bg-surface-secondary rounded-2xl p-6 border border-border shadow-sm">
      <div className="flex items-center gap-2 text-foreground font-bold mb-6 text-lg">
        <Terminal className="w-5 h-5 text-accent" />
        Deployment Assistant
      </div>
      
      <Tabs variant="secondary" className="w-full">
        <Tabs.ListContainer className="border-b border-border mb-4">
          <Tabs.List aria-label="Deployment options" className="w-full justify-start text-xs font-bold uppercase tracking-wider gap-6">
            {showDocker && (
              <Tabs.Tab id="docker" className="py-3">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Docker
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {showCompose && (
              <Tabs.Tab id="compose" className="py-3">
                <div className="flex items-center gap-2">
                  <Box className="w-4 h-4" />
                  Compose
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {showHelm && (
              <Tabs.Tab id="helm" className="py-3">
                <div className="flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  Helm
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>

        {showDocker && (
          <Tabs.Panel id="docker" className="pt-2">
            <div className="relative group">
              <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
                <code>{dockerCommand}</code>
              </pre>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                onPress={() => copyToClipboard(dockerCommand)}
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {app.customDockerNote ? (
              <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
                <span className="text-accent font-bold">Hinweis:</span> {app.customDockerNote}
              </p>
            ) : (
              <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
                <span className="text-accent font-bold">Hinweis:</span> Standard-Deployment mit Port 8080 mapping.
              </p>
            )}
          </Tabs.Panel>
        )}

        {showCompose && (
          <Tabs.Panel id="compose" className="pt-2">
            <div className="relative group">
              <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
                <code>{dockerCompose}</code>
              </pre>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                onPress={() => copyToClipboard(dockerCompose)}
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {app.customComposeNote && (
              <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
                <span className="text-accent font-bold">Hinweis:</span> {app.customComposeNote}
              </p>
            )}
          </Tabs.Panel>
        )}

        {showHelm && (
          <Tabs.Panel id="helm" className="pt-2">
            <div className="relative group">
              <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
                <code>{helmCommand}</code>
              </pre>
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                onPress={() => copyToClipboard(helmCommand)}
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            {app.customHelmNote ? (
              <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
                <span className="text-accent font-bold">Hinweis:</span> {app.customHelmNote}
              </p>
            ) : (
              <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
                <span className="text-accent font-bold">Hinweis:</span> Empfohlen für Kubernetes Umgebungen.
              </p>
            )}
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
};

