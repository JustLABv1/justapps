'use client';

import { AuthLayout } from '@/components/AuthLayout';
import { OIDCProviderSummary } from '@/config/apps';
import { Alert } from '@/components/panelui/alert';
import { Button } from '@/components/panelui/button';
import { Field } from '@/components/panelui/field';
import { Input } from '@/components/panelui/input';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { fetchApi } from '../../lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oidcProviders, setOidcProviders] = useState<OIDCProviderSummary[]>([]);
  const { user, oidcLogin } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const showOidcLogin = settings.oidcEnabled;

  React.useEffect(() => {
    fetchApi('/auth/oidc/providers')
      .then(async (response) => {
        if (!response.ok) {
          setOidcProviders([]);
          return;
        }
        const data = await response.json() as OIDCProviderSummary[];
        if (!Array.isArray(data)) {
          setOidcProviders([]);
          return;
        }
        setOidcProviders(data.filter((provider) => provider.configured));
      })
      .catch(() => {
        setOidcProviders([]);
      });
  }, []);

  React.useEffect(() => {
    if (user) {
      router.push('/');
    }
    if (settings.disableRegistration || settings.disableLocalAuth) {
      router.push('/login');
    }
  }, [user, router, settings.disableRegistration, settings.disableLocalAuth]);

  const handleOIDCLogin = () => {
    if (oidcProviders.length > 0) {
      oidcLogin(oidcProviders[0].key, '/');
      return;
    }
    oidcLogin();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/login');
      } else {
        setError(data.message || 'Registrierung fehlgeschlagen');
      }
    } catch (err) {
      console.error(err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Konto erstellen" subtitle="Registrieren Sie sich für einen neuen Account.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field>
          <Field.Label>E-Mail</Field.Label>
          <Input required type="email" autoComplete="email" placeholder="E-Mail eingeben" value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field>
          <Field.Label>Benutzername</Field.Label>
          <Input required autoComplete="username" placeholder="Benutzername wählen" value={username} onChange={(event) => setUsername(event.target.value)} />
        </Field>
        <Field>
          <Field.Label>Passwort</Field.Label>
          <Input required type="password" autoComplete="new-password" placeholder="Passwort wählen" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>

        {error && (
          <Alert variant="plain" tone="destructive">
            <Alert.Icon />
            <Alert.Title>{error}</Alert.Title>
          </Alert>
        )}

        <Button type="submit" size="lg" loading={loading} className="mt-1 w-full">
          Registrieren
        </Button>
      </form>

      {showOidcLogin && (
        <>
          <div className="my-5 flex items-center gap-3" role="separator">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase text-muted-foreground">Oder</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" onClick={handleOIDCLogin} variant="secondary" size="lg" className="w-full">
            {oidcProviders[0]?.label ? `Mit ${oidcProviders[0].label} anmelden` : 'Mit Single Sign-On anmelden'}
          </Button>
        </>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Haben Sie bereits ein Konto?{' '}
        <NextLink href="/login" className="font-medium text-foreground underline underline-offset-4">Anmelden</NextLink>
      </p>
    </AuthLayout>
  );
}
