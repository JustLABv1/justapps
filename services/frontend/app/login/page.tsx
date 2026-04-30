'use client';

import { AuthLayout } from '@/components/AuthLayout';
import { Button, Form, Input, Label, Link, Separator, TextField } from '@heroui/react';
import { ChevronDown } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
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

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const { user, login, oidcLogin } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));

  React.useEffect(() => {
    if (user) router.push(callbackUrl);
  }, [callbackUrl, user, router]);

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
        login(data.token, data.user);
        router.push(callbackUrl);
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

  const handleOIDCLogin = () => {
    oidcLogin(callbackUrl);
  };

  // Mode 1: OIDC disabled, only local auth
  if (!settings.oidcEnabled && showLocalAuth) {
    return (
      <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich mit Ihren Zugangsdaten an.">
        <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <TextField isRequired className="w-full" onChange={setEmail}>
            <Label className="text-sm font-medium text-foreground mb-1">E-Mail oder Benutzername</Label>
            <Input placeholder="E-Mail eingeben" className="w-full" value={email} />
          </TextField>
          <TextField isRequired className="w-full" type="password" onChange={setPassword}>
            <Label className="text-sm font-medium text-foreground mb-1">Passwort</Label>
            <Input placeholder="Passwort eingeben" className="w-full" value={password} />
          </TextField>
          {error && <p className="text-danger text-sm">{error}</p>}
          <Button type="submit" isPending={loading} className="w-full mt-2">
            {({ isPending }) => isPending ? 'Lädt...' : 'Anmelden'}
          </Button>
        </Form>
        {!settings.disableRegistration && (
          <div className="mt-6 text-center text-sm">
            <p className="text-muted">
              Noch keinen Account?{' '}
              <Link href="/register" className="text-accent font-medium">Registrieren</Link>
            </p>
          </div>
        )}
      </AuthLayout>
    );
  }

  // Mode 2: OIDC configured, local auth disabled → OIDC only
  if (!showLocalAuth) {
    return (
      <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich über Ihr Organisationskonto an.">
        <Button onPress={handleOIDCLogin} className="w-full">
          Mit Single Sign-On anmelden
        </Button>
      </AuthLayout>
    );
  }

  // Mode 3: OIDC configured + local auth available → OIDC primary, local auth behind toggle
  return (
    <AuthLayout title="Willkommen zurück" subtitle="Melden Sie sich mit Ihrem Konto an.">
      {/* Primary: OIDC */}
      <Button onPress={handleOIDCLogin} className="w-full">
        Mit Single Sign-On anmelden
      </Button>

      {/* Toggle for local auth */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowEmailForm((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors mx-auto"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEmailForm ? 'rotate-180' : ''}`} />
          {showEmailForm ? 'E-Mail-Anmeldung ausblenden' : 'Stattdessen mit E-Mail anmelden'}
        </button>
      </div>

      {showEmailForm && (
        <>
          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted font-medium uppercase">E-Mail & Passwort</span>
            <Separator className="flex-1" />
          </div>

          <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField isRequired className="w-full" onChange={setEmail}>
              <Label className="text-sm font-medium text-foreground mb-1">E-Mail oder Benutzername</Label>
              <Input placeholder="E-Mail eingeben" className="w-full" value={email} />
            </TextField>
            <TextField isRequired className="w-full" type="password" onChange={setPassword}>
              <Label className="text-sm font-medium text-foreground mb-1">Passwort</Label>
              <Input placeholder="Passwort eingeben" className="w-full" value={password} />
            </TextField>
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" isPending={loading} variant="outline" className="w-full mt-2">
              {({ isPending }) => isPending ? 'Lädt...' : 'Anmelden'}
            </Button>
          </Form>

          {!settings.disableRegistration && (
            <div className="mt-5 text-center text-sm">
              <p className="text-muted">
                Noch keinen Account?{' '}
                <Link href="/register" className="text-accent font-medium">Registrieren</Link>
              </p>
            </div>
          )}
        </>
      )}
    </AuthLayout>
  );
}
