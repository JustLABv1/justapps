'use client';

import { useStoreName } from '@/context/SettingsContext';
import { getApiUrl } from '@/lib/apiUrl';
import { Button, Card, Chip, Link } from '@heroui/react';
import { Bot, Check, Clipboard, ExternalLink, KeyRound, ShieldCheck, Terminal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

export default function ProfilMcpPage() {
  const router = useRouter();
  const storeName = useStoreName();
  const [endpoint, setEndpoint] = useState('/api/v1/mcp');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const apiUrl = getApiUrl();
      const absoluteApiUrl = apiUrl.startsWith('/')
        ? `${window.location.origin}${apiUrl}`
        : apiUrl;
      setEndpoint(`${absoluteApiUrl.replace(/\/$/, '')}/mcp`);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const config = useMemo(() => JSON.stringify({
    type: 'streamable-http',
    url: endpoint,
    headers: {
      Authorization: 'Bearer <MCP_TOKEN>',
    },
  }, null, 2), [endpoint]);

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied((current) => current === key ? null : current), 2200);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">MCP für deinen Agenten</h1>
            <Chip size="sm" color="success" variant="soft">Streamable HTTP</Chip>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Verbinde deinen Agenten mit dem {storeName}-Katalog. Er kann veröffentlichte Apps suchen und öffentliche Details sowie Deployment-Anleitungen lesen.
          </p>
        </div>
      </div>

      <Card variant="secondary" className="border border-accent/20 bg-accent/5">
        <Card.Header>
          <Card.Title className="text-base">1. Endpoint hinterlegen</Card.Title>
          <Card.Description>Das ist die MCP-Adresse deiner {storeName}-Installation.</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-3 text-sm text-foreground">
              {endpoint}
            </code>
            <Button variant="secondary" onPress={() => void copy(endpoint, 'endpoint')}>
              {copied === 'endpoint' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {copied === 'endpoint' ? 'Kopiert' : 'Kopieren'}
            </Button>
          </div>
        </Card.Content>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <KeyRound className="h-4 w-4 text-accent" />
              2. Zugriffstoken erstellen
            </Card.Title>
            <Card.Description>
              Dein Agent braucht ein persönliches {storeName}-Token im Authorization-Header.
            </Card.Description>
          </Card.Header>
          <Card.Content className="space-y-4">
            <ol className="space-y-3 text-sm text-muted">
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">1</span><span>Öffne die <Link href="/profil/tokens" className="font-semibold">Tokenverwaltung</Link>.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">2</span><span>Erstelle ein Token mit einer passenden Bezeichnung und Laufzeit.</span></li>
              <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent">3</span><span>Kopiere es direkt nach der Erstellung in die Konfiguration deines Agenten.</span></li>
            </ol>
          </Card.Content>
          <Card.Footer>
            <Button onPress={() => router.push('/profil/tokens')}>
              Tokenverwaltung öffnen
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Card.Footer>
        </Card>

        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-accent" />
              3. Agent konfigurieren
            </Card.Title>
            <Card.Description>Die genaue Bezeichnung des Konfigurationsblocks hängt vom Agenten ab.</Card.Description>
          </Card.Header>
          <Card.Content>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-border bg-[oklch(0.18_0.01_250)] p-4 text-xs leading-relaxed text-[oklch(0.92_0_0)]"><code>{config}</code></pre>
              <Button
                isIconOnly
                size="sm"
                variant="tertiary"
                className="absolute right-2 top-2 bg-white/10 text-white hover:bg-white/20"
                aria-label="MCP-Konfiguration kopieren"
                onPress={() => void copy(config, 'config')}
              >
                {copied === 'config' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              </Button>
            </div>
          </Card.Content>
        </Card>
      </div>

      <Card>
        <Card.Header>
          <Card.Title className="text-base">Was dein Agent nutzen kann</Card.Title>
          <Card.Description>Der MCP ist bewusst schreibgeschützt und stellt nur veröffentlichte Katalogdaten bereit.</Card.Description>
        </Card.Header>
        <Card.Content className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <p className="font-mono text-sm font-semibold text-foreground">search_apps</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Apps nach Freitext, Kategorie, Technologie oder Status finden.</p>
          </div>
          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <p className="font-mono text-sm font-semibold text-foreground">get_app</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">Öffentliche Metadaten, Links und Deployment-Anleitungen zu einer App lesen.</p>
          </div>
        </Card.Content>
        <Card.Footer className="flex items-start gap-3 border-t border-border/60 pt-4">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <p className="text-xs leading-relaxed text-muted">Owner-Daten, Provider-Credentials, Berechtigungen und interne Synchronisationsdaten werden nicht an den Agenten ausgeliefert.</p>
        </Card.Footer>
      </Card>
    </div>
  );
}
