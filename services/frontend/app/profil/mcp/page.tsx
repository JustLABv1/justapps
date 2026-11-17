'use client';

import { CodeBlock } from '@/components/CodeBlock';
import { CopyField, CreateTokenForm, TokenReveal, daysUntil, useUserTokens } from '@/components/profile/tokens';
import { Badge } from '@/components/panelui/badge';
import { Card } from '@/components/panelui/card';
import { Tabs } from '@/components/panelui/tabs';
import { useStoreName } from '@/context/SettingsContext';
import { getApiUrl } from '@/lib/apiUrl';
import { toast } from '@/lib/toast';
import { Check, EyeOff, Search, ShieldCheck, FileText } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

const TOKEN_PLACEHOLDER = '<DEIN_TOKEN>';

const TOOLS = [
  { name: 'search_apps', icon: Search, description: 'Apps nach Freitext, Kategorie, Technologie oder Status finden.' },
  { name: 'get_app', icon: FileText, description: 'Öffentliche Angaben, Links und Installationsanleitungen einer App lesen.' },
];

function slug(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'justapps';
}

function Step({ index, title, description, done, last, children }: {
  index: number;
  title: string;
  description?: ReactNode;
  done?: boolean;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <li className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 pb-10 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute top-10 bottom-2 left-4 w-px bg-border" />}
      <span
        aria-hidden="true"
        className={`flex size-8 items-center justify-center rounded-full text-sm font-medium tabular-nums transition-colors ${
          done ? 'bg-success/15 text-success' : 'border bg-background'
        }`}
      >
        {done ? <Check className="size-4" /> : index}
      </span>
      <div className="flex min-w-0 flex-col gap-4 pt-1">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">
            <span className="sr-only">Schritt {index}{done ? ', erledigt' : ''}: </span>
            {title}
          </h3>
          {description && <p className="text-sm text-pretty text-muted-foreground">{description}</p>}
        </div>
        {children}
      </div>
    </li>
  );
}

export default function ProfilMcpPage() {
  const storeName = useStoreName();
  const { tokens, create } = useUserTokens();
  const [endpoint, setEndpoint] = useState('/api/v1/mcp');
  const [token, setToken] = useState<string | null>(null);
  const [client, setClient] = useState('json');

  useEffect(() => {
    const id = window.setTimeout(() => {
      const apiUrl = getApiUrl();
      const absolute = apiUrl.startsWith('/') ? `${window.location.origin}${apiUrl}` : apiUrl;
      setEndpoint(`${absolute.replace(/\/$/, '')}/mcp`);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const activeTokens = tokens.filter((item) => !item.disabled && (daysUntil(item.expires_at) ?? 1) > 0).length;
  const serverName = slug(storeName);
  const bearer = `Bearer ${token ?? TOKEN_PLACEHOLDER}`;

  const configs = useMemo(() => ({
    json: {
      label: 'Allgemein',
      filename: 'mcp.json',
      language: 'json',
      code: JSON.stringify({ type: 'streamable-http', url: endpoint, headers: { Authorization: bearer } }, null, 2),
      hint: 'Für Agenten, die Streamable HTTP unterstützen. Wo der Block hingehört, steht in der Anleitung deines Agenten.',
    },
    claude: {
      label: 'Claude Code',
      filename: 'Terminal',
      language: 'bash',
      code: `claude mcp add --transport http ${serverName} ${endpoint} \\\n  --header "Authorization: ${bearer}"`,
      hint: 'Einmal im Terminal ausführen. Danach steht der Server in jeder Sitzung zur Verfügung.',
    },
    vscode: {
      label: 'VS Code',
      filename: '.vscode/mcp.json',
      language: 'json',
      code: JSON.stringify({ servers: { [serverName]: { type: 'http', url: endpoint, headers: { Authorization: bearer } } } }, null, 2),
      hint: 'In die Datei .vscode/mcp.json deines Projekts oder in die Benutzereinstellungen eintragen.',
    },
  }), [bearer, endpoint, serverName]);

  const config = configs[client as keyof typeof configs];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold tracking-tight">MCP einrichten</h2>
          <Badge variant="outline" size="sm">Streamable HTTP</Badge>
        </div>
        <p className="max-w-2xl text-pretty text-muted-foreground">
          Verbinde deinen KI-Agenten mit dem {storeName}-Katalog. Er findet dann passende Apps und liest ihre Anleitungen – nur lesend.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <Card>
          <Card.Content className="py-2">
            <ol>
              <Step index={1} title="Adresse des Servers" description={`Unter dieser Adresse erreicht dein Agent ${storeName}.`}>
                <CopyField value={endpoint} label="MCP-Adresse" />
              </Step>

              <Step
                index={2}
                done={!!token}
                title="Token erstellen"
                description={token
                  ? 'Das Token ist unten in der Konfiguration schon eingesetzt.'
                  : <>Dein Agent meldet sich mit einem persönlichen Token an.{activeTokens > 0 && <> Du hast schon {activeTokens} aktive{activeTokens === 1 ? 's' : ''} – den vollen Wert sehen wir aber nur direkt beim Erstellen. Verwalten kannst du sie unter <NextLink href="/profil/tokens" className="font-medium text-foreground underline underline-offset-4">API-Tokens</NextLink>.</>}</>}
              >
                {token ? (
                  <TokenReveal token={token} />
                ) : (
                  <CreateTokenForm
                    create={create}
                    onCreated={(created) => {
                      setToken(created);
                      toast.success('Token erstellt und in die Konfiguration eingesetzt.');
                    }}
                  />
                )}
              </Step>

              <Step index={3} last title="Agent konfigurieren" description={config.hint}>
                <div className="flex flex-col gap-3">
                  <Tabs value={client} onValueChange={(value) => setClient(String(value))}>
                    <Tabs.List aria-label="Agent auswählen">
                      {Object.entries(configs).map(([key, item]) => (
                        <Tabs.Trigger key={key} value={key}>{item.label}</Tabs.Trigger>
                      ))}
                    </Tabs.List>
                  </Tabs>
                  <CodeBlock code={config.code} label={`Konfiguration für ${config.label}`} filename={config.filename} language={config.language} />
                  {!token && (
                    <p className="text-sm text-muted-foreground">
                      Ersetze <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{TOKEN_PLACEHOLDER}</code> durch dein Token – oder erstelle es in Schritt 2, dann setzen wir es hier ein.
                    </p>
                  )}
                </div>
              </Step>
            </ol>
          </Card.Content>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card size="sm">
            <Card.Header>
              <Card.Title>Was dein Agent kann</Card.Title>
            </Card.Header>
            <Card.Content>
              <ul className="flex flex-col gap-4">
                {TOOLS.map(({ name, icon: Icon, description }) => (
                  <li key={name} className="flex gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <code className="font-mono text-sm font-medium">{name}</code>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card.Content>
          </Card>
          <Card size="sm">
            <Card.Header>
              <Card.Title className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-success" />
                Nur lesend
              </Card.Title>
              <Card.Description>Der Agent sieht nur veröffentlichte Katalogdaten und kann nichts ändern.</Card.Description>
            </Card.Header>
            <Card.Content>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <EyeOff className="mt-0.5 size-4 shrink-0" />
                Verantwortliche, Zugangsdaten, Berechtigungen und interne Synchronisationsdaten bekommt er nicht.
              </p>
            </Card.Content>
          </Card>
        </aside>
      </div>
    </div>
  );
}
