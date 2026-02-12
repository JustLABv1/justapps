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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface rounded-lg p-5 border border-border">
      <div className="flex items-center gap-2 text-foreground font-semibold mb-4">
        <Terminal className="w-4 h-4" />
        Deployment Assistant
      </div>
      
      <Tabs variant="secondary" className="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Deployment options" className="w-full justify-start text-[10px] font-bold uppercase tracking-wider">
            <Tabs.Tab id="docker">
              <div className="flex items-center gap-2 px-2">
                <Box className="w-3 h-3" />
                Docker
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="compose">
              <div className="flex items-center gap-2 px-2">
                <Box className="w-3 h-3" />
                Compose
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="helm">
              <div className="flex items-center gap-2 px-2">
                <Ship className="w-3 h-3" />
                Helm
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="docker" className="pt-4">
          <div className="relative group">
            <pre className="bg-[oklch(0.18_0.01_250)] text-[oklch(0.92_0_0)] p-4 rounded-lg text-xs sm:text-sm overflow-x-auto leading-relaxed font-mono">
              <code>{dockerCommand}</code>
            </pre>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onPress={() => copyToClipboard(dockerCommand)}
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          {app.customDockerNote ? (
            <p className="text-xs text-muted mt-2 italic px-1">
              {app.customDockerNote}
            </p>
          ) : (
            <p className="text-xs text-muted mt-2 italic px-1">
              Standard-Deployment mit Port 8080 mapping.
            </p>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="compose" className="pt-4">
          <div className="relative group">
            <pre className="bg-[oklch(0.18_0.01_250)] text-[oklch(0.92_0_0)] p-4 rounded-lg text-xs sm:text-sm overflow-x-auto leading-relaxed font-mono">
              <code>{dockerCompose}</code>
            </pre>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onPress={() => copyToClipboard(dockerCompose)}
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          {app.customComposeNote && (
            <p className="text-xs text-muted mt-2 italic px-1">
              {app.customComposeNote}
            </p>
          )}
        </Tabs.Panel>

        <Tabs.Panel id="helm" className="pt-4">
          <div className="relative group">
            <pre className="bg-[oklch(0.18_0.01_250)] text-[oklch(0.92_0_0)] p-4 rounded-lg text-xs sm:text-sm overflow-x-auto leading-relaxed font-mono">
              <code>{helmCommand}</code>
            </pre>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onPress={() => copyToClipboard(helmCommand)}
            >
              {copied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
          {app.customHelmNote ? (
            <p className="text-xs text-muted mt-2 italic px-1">
              {app.customHelmNote}
            </p>
          ) : (
            <p className="text-xs text-muted mt-2 italic px-1">
              Empfohlen für Kubernetes Umgebungen.
            </p>
          )}
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};
