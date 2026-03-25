"use client";

import { AppConfig, DeploymentVariant } from '@/config/apps';
import { Alert, Button, ListBox, Select, Tabs, Tooltip } from '@heroui/react';
import { Check, Code2, Copy, FileCode, Info, Layers, Ship, Terminal } from 'lucide-react';
import React, { useState } from 'react';

interface DeploymentAssistantProps {
  app: AppConfig;
}

export const DeploymentAssistant: React.FC<DeploymentAssistantProps> = ({ app }) => {
  const [copied, setCopied] = useState(false);
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number>(-1);

  const variants = app.deploymentVariants ?? [];
  const hasVariants = variants.length > 0;

  // Active variant overrides base commands when selected
  const activeVariant: DeploymentVariant | null = selectedVariantIdx >= 0 ? (variants[selectedVariantIdx] ?? null) : null;

  const helmValues = activeVariant?.helmValues || app.customHelmValues;
  const showValues = Boolean(helmValues);

  const helmCommand = (activeVariant?.helmCommand || app.customHelmCommand) ||
    `helm repo add bund ${app.helmRepo || 'https://charts.bund.de'}
helm install ${app.id} bund/${app.id} ${showValues ? '-f values.yaml' : ''}`;

  const dockerCommand = (activeVariant?.dockerCommand || app.customDockerCommand) ||
    `docker pull ${app.dockerRepo || `ghcr.io/bund/${app.id}:latest`}
docker run -d --name ${app.id} -p 8080:80 ${app.dockerRepo || `ghcr.io/bund/${app.id}:latest`}`;

  const composeCommand = (activeVariant?.composeCommand || app.customComposeCommand) ||
    `version: '3.8'
services:
  ${app.id}:
    image: ${app.dockerRepo || `ghcr.io/bund/${app.id}:latest`}
    ports:
      - "8080:80"
    restart: always`;

  const helmNote = activeVariant?.helmNote || app.customHelmNote;
  const composeNote = activeVariant?.composeNote || app.customComposeNote;
  const dockerNote = activeVariant?.dockerNote || app.customDockerNote;

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
        <Terminal className="w-7 h-7 text-accent" />
        Deployment Assistant
      </div>

      {/* Variant selector */}
      {hasVariants && (
        <div className="mb-6 p-4 bg-surface rounded-xl border border-border flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground shrink-0">
            <Layers className="w-4 h-4 text-accent" />
            Deployment-Variante:
          </div>
          <Select
            aria-label="Deployment-Variante wählen"
            selectedKey={selectedVariantIdx === -1 ? 'base' : String(selectedVariantIdx)}
            onSelectionChange={(key) => {
              const k = String(key);
              setSelectedVariantIdx(k === 'base' ? -1 : parseInt(k));
            }}
            className="flex-1 min-w-48"
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="base" textValue="Standard">Standard<ListBox.ItemIndicator /></ListBox.Item>
                {variants.map((v, i) => (
                  <ListBox.Item key={i} id={String(i)} textValue={v.name}>{v.name}<ListBox.ItemIndicator /></ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
          {activeVariant?.description && (
            <p className="text-xs text-muted">{activeVariant.description}</p>
          )}
        </div>
      )}

      <Alert status="accent" className="mb-6">
        <Alert.Indicator>
          <Info className="w-4 h-4" />
        </Alert.Indicator>
        <Alert.Content>
          <Alert.Title>Wählen Sie eine Deploy-Methode</Alert.Title>
          <Alert.Description>
            Für die PLAIN-Umgebung wird die Nutzung von Helm Charts empfohlen.
            Alternative Methoden wie Docker oder Compose stehen für Entwicklung und Lokale-Tests zur Verfügung.
          </Alert.Description>
        </Alert.Content>
      </Alert>
      
      <Tabs variant="secondary" className="w-full" defaultSelectedKey={showHelm ? 'helm' : (showCompose ? 'compose' : 'docker')}>
        <Tabs.ListContainer className="border-b border-border mb-4">
          <Tabs.List aria-label="Deployment options" className="w-full justify-start text-xs font-bold uppercase tracking-wider gap-8">
            {showHelm && (
              <Tabs.Tab id="helm" className="py-3">
                <div className="flex items-center gap-2">
                  <Ship className="w-4 h-4" />
                  Helm Chart
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {showCompose && (
              <Tabs.Tab id="compose" className="py-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Compose
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
            {showDocker && (
              <Tabs.Tab id="docker" className="py-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4" />
                  Docker
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            )}
          </Tabs.List>
        </Tabs.ListContainer>

        {showHelm && (
          <Tabs.Panel id="helm" className="pt-2">
            <div className="relative group mb-6">
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

            {helmValues && (
              <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2 px-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <FileCode className="w-4 h-4 text-accent" />
                    values.yaml Konfiguration
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-7 text-xs font-semibold"
                    onPress={() => copyToClipboard(helmValues)}
                  >
                    <Copy className="w-3 h-3" />
                    Values kopieren
                  </Button>
                </div>
                <div className="relative group">
                  <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/5 max-h-[400px]">
                    <code>{helmValues}</code>
                  </pre>
                </div>
                <div className="p-3 bg-surface rounded-lg border border-border">
                  <p className="text-xs text-muted leading-relaxed">
                    Hinweis: Speichern Sie diesen Inhalt als <code className="text-accent font-mono">values.yaml</code> ab und führen Sie den obigen Helm-Befehl aus.
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-muted mt-8 flex items-start gap-2 bg-surface p-3 rounded-lg border border-border font-medium">
              <span className="text-accent font-bold">Zusatzinfo:</span> {helmNote || 'Standard Helm Installation für Kubernetes Umgebungen.'}
            </p>
          </Tabs.Panel>
        )}

        {showCompose && (
          <Tabs.Panel id="compose" className="pt-2">
            <div className="relative group">
              <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
                <code>{composeCommand}</code>
              </pre>
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="secondary"
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    onPress={() => copyToClipboard(composeCommand)}
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
              <span className="text-accent font-bold">Hinweis:</span> {composeNote || 'Standard Docker Compose Setup für lokale Erprobung.'}
            </p>
          </Tabs.Panel>
        )}

        {showDocker && (
          <Tabs.Panel id="docker" className="pt-2">
            <div className="relative group">
              <pre className="bg-[#1e1e2e] text-[#d4d4d4] p-5 rounded-xl text-sm overflow-x-auto leading-relaxed font-mono shadow-inner border border-white/10">
                <code>{dockerCommand}</code>
              </pre>
              <Tooltip delay={0}>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="secondary"
                    className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white border border-white/20 min-w-8 w-8 h-8 opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
                    onPress={() => copyToClipboard(dockerCommand)}
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
              <span className="text-accent font-bold">Hinweis:</span> {dockerNote || 'Direkter Docker-Start für Testzwecke.'}
            </p>
          </Tabs.Panel>
        )}
      </Tabs>
    </div>
  );
};



