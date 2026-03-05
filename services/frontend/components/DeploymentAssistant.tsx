"use client";

import { AppConfig } from '@/config/apps';
import { Alert, Button, Label, Switch, Tabs, Tooltip } from '@heroui/react';
import { Check, Copy, FileCode, Info, Ship } from 'lucide-react';
import React, { useState } from 'react';

interface DeploymentAssistantProps {
  app: AppConfig;
}

export const DeploymentAssistant: React.FC<DeploymentAssistantProps> = ({ app }) => {
  const [copied, setCopied] = useState(false);
  const [showValues, setShowValues] = useState(false);

  const defaultHelmValues = `## Custom values for ${app.id}
image:
  repository: ${app.dockerRepo || `ghcr.io/bund/${app.id}`}
  tag: latest
service:
  port: 80
ingress:
  enabled: true
  host: ${app.id}.local
resources:
  limits:
    cpu: 200m
    memory: 256Mi`;

  const helmValues = app.customHelmValues || defaultHelmValues;

  const helmCommand = app.customHelmCommand || `helm repo add bund ${app.helmRepo || 'https://charts.bund.de'}
helm install ${app.id} bund/${app.id} ${showValues ? '-f values.yaml' : ''}`;

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
      <div className="flex items-center gap-3 text-foreground font-bold mb-6 text-xl">
        <Ship className="w-7 h-7 text-accent" />
        Helm Deployment Assistant
      </div>

      <Alert status="accent" className="mb-6">
        <Alert.Indicator>
          <Info className="w-4 h-4" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Helm Installation</Alert.Title>
          <Alert.Description>
            Helm ist der bevorzugte Weg für Deployments in der PLAIN-Umgebung. 
            Nutzen Sie die Values-Datei für spezifische Konfigurationen.
          </Alert.Description>
        </Alert.Content>
      </Alert>
      
      <Tabs variant="secondary" className="w-full" defaultSelectedKey="helm">
        <Tabs.ListContainer className="border-b border-border mb-4">
          <Tabs.List aria-label="Deployment options" className="w-full justify-start text-xs font-bold uppercase tracking-wider gap-8">
            <Tabs.Tab id="helm" className="py-3">
              <div className="flex items-center gap-2">
                <Ship className="w-4 h-4" />
                Helm Chart
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="values" className="py-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4" />
                Values Config
              </div>
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel id="helm" className="pt-2">
          {!app.customHelmCommand && (
            <div className="flex items-center justify-between mb-4 bg-surface p-3 rounded-xl border border-border">
              <Label className="text-sm font-medium">Mit custom values.yaml installieren?</Label>
              <Switch 
                isSelected={showValues} 
                onChange={setShowValues}
                size="sm"
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>
          )}
          <div className="relative group">
            <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
              <code>{helmCommand}</code>
            </pre>
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                  onPress={() => copyToClipboard(helmCommand)}
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>{copied ? 'Kopiert!' : 'Kopieren'}</p>
              </Tooltip.Content>
            </Tooltip>
          </div>
          <p className="text-sm text-muted mt-4 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border">
            <span className="text-accent font-bold">Hinweis:</span> {app.customHelmNote || 'Standard Helm Installation für Kubernetes Umgebungen.'}
          </p>
        </Tabs.Panel>

        <Tabs.Panel id="values" className="pt-2">
          <div className="relative group">
            <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
              <code>{helmValues}</code>
            </pre>
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="secondary"
                  className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                  onPress={() => copyToClipboard(helmValues)}
                >
                  {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content showArrow placement="top">
                <Tooltip.Arrow />
                <p>{copied ? 'Kopiert!' : 'Kopieren'}</p>
              </Tooltip.Content>
            </Tooltip>
          </div>
          <div className="mt-4 p-3 bg-surface rounded-lg border border-border mb-2">
            <p className="text-xs text-muted leading-relaxed">
              Speichern Sie diesen Inhalt als <code className="text-accent">values.yaml</code> ab, um Port-Mapping, Image-Tags und Ingress-Hosts anzupassen.
            </p>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

