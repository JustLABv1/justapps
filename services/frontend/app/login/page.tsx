'use client';

import { AuthLayout } from '@/components/AuthLayout';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import { OIDCProviderSummary } from '@/config/apps';
import { ChevronDown } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchApi } from '../../lib/api';

function getSafeCallbackUrl(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }

  return value;
}

function readSafeCallbackUrl(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return getSafeCallbackUrl(new URLSearchParams(window.location.search).get('callbackUrl'));
}

function readOIDCResult() {
  if (typeof window === 'undefined') {
    return { error: null as string | null };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    error: params.get('oidc_error'),
  };
}

function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Alert variant="plain" tone="destructive">
      <Alert.Icon />
      <Alert.Title>{message}</Alert.Title>
    </Alert>
  );
}

function RegisterHint() {
  return (
    <p className="mt-6 text-center text-sm text-muted-foreground">
      Noch keinen Account?{' '}
      <NextLink href="/register" className="font-medium text-foreground underline underline-offset-4">Registrieren</NextLink>
    </p>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(() => readOIDCResult().error || '');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [oidcProviders, setOidcProviders] = useState<OIDCProviderSummary[]>([]);
  const [oidcLoading, setOidcLoading] = useState(true);
  const { user, login, oidcLogin } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  React.useEffect(() => {
    const oidcResult = readOIDCResult();
    if (user && !oidcResult.error) {
      router.push(readSafeCallbackUrl());
    }
  }, [user, router]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetchApi('/auth/oidc/providers');
        if (!response.ok) {
          if (active) {
            setOidcProviders([]);
          }
          return;
        }

        const data = await response.json() as OIDCProviderSummary[];
        if (!Array.isArray(data)) {
          if (active) {
            setOidcProviders([]);
          }
          return;
        }

        if (active) {
          setOidcProviders(data.filter((provider) => provider.configured));
        }
      } catch {
        if (active) {
          setOidcProviders([]);
        }
      } finally {
        if (active) {
          setOidcLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        login(data.user);
        router.push(readSafeCallbackUrl());
      } else {
        setError(data.message || 'Anmeldung fehlgeschlagen');
      }
    } catch (err) {
      console.error(err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const showLocalAuth = !settings.disableLocalAuth;
  const hasDynamicProviders = oidcProviders.length > 0;
  const showOIDC = settings.oidcEnabled;

  const handleOIDCLogin = (providerKey?: string) => {
    oidcLogin(providerKey, readSafeCallbackUrl());
  };

  const renderOIDCButtons = () => {
    if (!showOIDC) {
      return null;
    }

    if (!hasDynamicProviders) {
      return (
        <Button size="lg" onClick={() => handleOIDCLogin()} className="w-full" disabled={oidcLoading}>
          Mit Single Sign-On anmelden
        </Button>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {oidcProviders.map((provider) => (
          <Button key={provider.key} size="lg" onClick={() => handleOIDCLogin(provider.key)} className="w-full">
            {provider.label || 'Single Sign-On'}
          </Button>
        ))}
      </div>
    );
  };

  const renderLocalForm = (primary: boolean) => (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <Field.Label>E-Mail oder Benutzername</Field.Label>
        <Input required autoComplete="username" placeholder="E-Mail eingeben" value={email} onChange={(event) => setEmail(event.target.value)} />
      </Field>
      <Field>
        <Field.Label>Passwort</Field.Label>
        <Input required type="password" autoComplete="current-password" placeholder="Passwort eingeben" value={password} onChange={(event) => setPassword(event.target.value)} />
      </Field>
      <ErrorMessage message={error} />
      <Button type="submit" size="lg" variant={primary ? 'default' : 'secondary'} loading={loading} className="mt-1 w-full">
        Anmelden
      </Button>
    </form>
  );

  // Mode 1: OIDC disabled, only local auth
  if (!showOIDC && showLocalAuth) {
    return (
      <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich mit Ihren Zugangsdaten an.">
        {renderLocalForm(true)}
        {!settings.disableRegistration && <RegisterHint />}
      </AuthLayout>
    );
  }

  // Mode 2: OIDC configured, local auth disabled → OIDC only
  if (!showLocalAuth) {
    return (
      <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich über Ihr Organisationskonto an.">
        <div className="flex flex-col gap-3">
          {renderOIDCButtons()}
          <ErrorMessage message={error} />
        </div>
      </AuthLayout>
    );
  }

  // Mode 3: OIDC configured + local auth available → OIDC primary, local auth behind toggle
  return (
    <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich mit Ihrem Konto an.">
      <div className="flex flex-col gap-3">
        {renderOIDCButtons()}
        {!showEmailForm && <ErrorMessage message={error} />}
      </div>

      <button
        type="button"
        aria-expanded={showEmailForm}
        onClick={() => setShowEmailForm((v) => !v)}
        className="mx-auto mt-4 flex items-center gap-1.5 rounded-md px-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ChevronDown className={`size-3.5 transition-transform ${showEmailForm ? 'rotate-180' : ''}`} />
        {showEmailForm ? 'E-Mail-Anmeldung ausblenden' : 'Stattdessen mit E-Mail anmelden'}
      </button>

      {showEmailForm && (
        <>
          <div className="my-5 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase text-muted-foreground">E-Mail &amp; Passwort</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          {renderLocalForm(false)}
          {!settings.disableRegistration && <RegisterHint />}
        </>
      )}
    </AuthLayout>
  );
}
